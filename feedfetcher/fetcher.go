package feedfetcher

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-redis/redis/v8"
	"github.com/mmcdole/gofeed"
)

type Fetcher struct {
	redisClient *redis.Client
	s3Client    *s3.Client
	httpClient  *http.Client
	s3Bucket    string
}

type FeedResponse struct {
	Success       bool     `json:"success"`
	Title         string   `json:"title,omitempty"`
	Link          string   `json:"link,omitempty"`
	LastModified  string   `json:"lastModified,omitempty"`
	Etag          string   `json:"etag,omitempty"`
	Articles      []string `json:"articles"`
	StatusCode    int      `json:"statusCode,omitempty"`
	StatusMessage string   `json:"statusMessage,omitempty"`
}

func NewFetcher(redisClient *redis.Client, s3Client *s3.Client, s3Bucket string) *Fetcher {
	return &Fetcher{
		redisClient: redisClient,
		s3Client:    s3Client,
		httpClient:  &http.Client{},
		s3Bucket:    s3Bucket,
	}
}

func (f *Fetcher) FetchFeed(ctx context.Context, feedURI string) (*FeedResponse, error) {
	keys := BuildRedisKeys(feedURI)

	// Fetch stored feed metadata from Redis
	storedFeed, err := f.redisClient.HGetAll(ctx, keys.FeedKey).Result()
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to get stored feed: %w", err)
	}

	// Build request headers with cached etag/lastModified
	headers := BuildRequestHeaders(storedFeed["lastModified"], storedFeed["etag"])

	// Fetch the feed
	req, err := http.NewRequestWithContext(ctx, "GET", feedURI, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return &FeedResponse{
			Success:       false,
			StatusMessage: err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	// Handle HTTP status codes
	if resp.StatusCode == http.StatusNotModified {
		// Feed not modified, return cached articles
		articles, err := f.getArticleIds(ctx, keys.ArticlesKey)
		if err != nil {
			return nil, err
		}
		return &FeedResponse{
			Success:      true,
			Title:        storedFeed["title"],
			Link:         storedFeed["link"],
			LastModified: storedFeed["lastModified"],
			Etag:         storedFeed["etag"],
			Articles:     articles,
			StatusCode:   resp.StatusCode,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return &FeedResponse{
			Success:       false,
			StatusCode:    resp.StatusCode,
			StatusMessage: resp.Status,
		}, nil
	}

	// Parse the feed
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	fp := gofeed.NewParser()
	feed, err := fp.ParseString(string(body))
	if err != nil {
		return &FeedResponse{
			Success:       false,
			StatusMessage: fmt.Sprintf("failed to parse feed: %v", err),
		}, nil
	}

	// Store feed metadata in Redis
	lastModified := resp.Header.Get("Last-Modified")
	etag := resp.Header.Get("Etag")

	feedMeta := map[string]interface{}{
		"title":        feed.Title,
		"link":         feed.Link,
		"lastModified": lastModified,
		"etag":         etag,
	}

	if err := f.redisClient.HMSet(ctx, keys.FeedKey, feedMeta).Err(); err != nil {
		return nil, fmt.Errorf("failed to store feed metadata: %w", err)
	}

	// Process articles
	for _, item := range feed.Items {
		article := Article{
			GUID:        item.GUID,
			Title:       item.Title,
			Description: item.Description,
		}

		// Use published date or updated date
		if item.PublishedParsed != nil {
			article.PubDate = item.PublishedParsed.Format("2006-01-02T15:04:05Z07:00")
		} else if item.UpdatedParsed != nil {
			article.PubDate = item.UpdatedParsed.Format("2006-01-02T15:04:05Z07:00")
		}

		// Validate article
		if !IsValidArticle(&article) {
			continue
		}

		// Process article
		processedArticle := ProcessArticle(article, feedURI)
		articleKey := BuildArticleKey(processedArticle.Hash)

		// Get old score from Redis
		oldScoreStr, err := f.redisClient.ZScore(ctx, keys.ArticlesKey, articleKey).Result()
		var oldScore *string
		if err == nil {
			scoreStr := strconv.FormatInt(int64(oldScoreStr), 10)
			oldScore = &scoreStr
		}

		// Add article to sorted set
		err = f.redisClient.ZAdd(ctx, keys.ArticlesKey, &redis.Z{
			Score:  float64(processedArticle.Score),
			Member: articleKey,
		}).Err()
		if err != nil {
			return nil, fmt.Errorf("failed to add article to sorted set: %w", err)
		}

		// Store article in S3 if score changed
		if ShouldStoreArticle(oldScore, processedArticle.Score) {
			if err := f.storeArticleInS3(ctx, processedArticle); err != nil {
				return nil, fmt.Errorf("failed to store article in S3: %w", err)
			}
		}
	}

	// Get all article IDs
	articles, err := f.getArticleIds(ctx, keys.ArticlesKey)
	if err != nil {
		return nil, err
	}

	return &FeedResponse{
		Success:      true,
		Title:        feed.Title,
		Link:         feed.Link,
		LastModified: lastModified,
		Etag:         etag,
		Articles:     articles,
		StatusCode:   resp.StatusCode,
	}, nil
}

func (f *Fetcher) storeArticleInS3(ctx context.Context, article Article) error {
	body, err := GenerateArticleBody(article)
	if err != nil {
		return err
	}

	_, err = f.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(f.s3Bucket),
		Key:         aws.String(article.Hash + ".json"),
		Body:        bytes.NewReader([]byte(body)),
		ContentType: aws.String("application/json"),
	})

	return err
}

func (f *Fetcher) getArticleIds(ctx context.Context, articlesKey string) ([]string, error) {
	allArticles, err := f.redisClient.ZRevRange(ctx, articlesKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get articles from sorted set: %w", err)
	}

	return ExtractArticleIds(allArticles), nil
}
