//go:build integration
// +build integration

package feedfetcher

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-redis/redis/v8"
	"gopkg.in/yaml.v3"
)

type FeedGetTestCases struct {
	FeedGetTests []struct {
		Description            string `yaml:"description"`
		FeedFixture            string `yaml:"feed_fixture"`
		FeedURI                string `yaml:"feed_uri"`
		ExpectedFeedMetadata   struct {
			Title string `yaml:"title"`
			Link  string `yaml:"link"`
		} `yaml:"expected_feed_metadata"`
		ExpectedArticlesCount int `yaml:"expected_articles_count"`
		ExpectedArticles      []struct {
			GUID    string `yaml:"guid"`
			Title   string `yaml:"title"`
			Hash    string `yaml:"hash"`
			Score   int64  `yaml:"score"`
			FeedURL string `yaml:"feedurl"`
		} `yaml:"expected_articles"`
	} `yaml:"feed_get_tests"`
}

func setupRedisClient() (*redis.Client, error) {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}

func setupS3Client() (*s3.Client, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:9000"
	}

	accessKey := os.Getenv("S3_ACCESS_KEY")
	if accessKey == "" {
		accessKey = "minioadmin"
	}

	secretKey := os.Getenv("S3_SECRET_KEY")
	if secretKey == "" {
		secretKey = "minioadmin"
	}

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("us-east-1"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	return client, nil
}

func TestFeedGetIntegration(t *testing.T) {
	// Load test cases
	data, err := os.ReadFile("../testdata/feed-get-tests.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases FeedGetTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	// Setup Redis and S3 clients
	redisClient, err := setupRedisClient()
	if err != nil {
		t.Fatalf("Failed to setup Redis client: %v", err)
	}
	defer redisClient.Close()

	s3Client, err := setupS3Client()
	if err != nil {
		t.Fatalf("Failed to setup S3 client: %v", err)
	}

	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "feedreader2018-articles"
	}

	// Run tests
	for _, tc := range testCases.FeedGetTests {
		t.Run(tc.Description, func(t *testing.T) {
			ctx := context.Background()

			// Clear Redis data for this test
			keys := BuildRedisKeys(tc.FeedURI)
			redisClient.Del(ctx, keys.FeedKey, keys.ArticlesKey)

			// Load feed fixture
			feedData, err := os.ReadFile(tc.FeedFixture)
			if err != nil {
				t.Fatalf("Failed to read feed fixture: %v", err)
			}

			// Create test HTTP server to serve the feed
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/xml")
				w.Write(feedData)
			}))
			defer server.Close()

			// Create FeedGetter and fetch the feed
			fg := NewFeedGetter(redisClient, s3Client, bucket)
			result, err := fg.Get(ctx, server.URL)
			if err != nil {
				t.Fatalf("FeedGetter.Get() failed: %v", err)
			}

			// Verify success
			if !result.Success {
				t.Errorf("Expected success=true, got success=%v, message=%s", result.Success, result.StatusMessage)
			}

			// Verify feed metadata
			if tc.ExpectedFeedMetadata.Title != "" {
				if result.Title != tc.ExpectedFeedMetadata.Title {
					t.Errorf("Title mismatch: got %s, want %s", result.Title, tc.ExpectedFeedMetadata.Title)
				}
			}

			if tc.ExpectedFeedMetadata.Link != "" {
				if result.Link != tc.ExpectedFeedMetadata.Link {
					t.Errorf("Link mismatch: got %s, want %s", result.Link, tc.ExpectedFeedMetadata.Link)
				}
			}

			// Verify article count
			if len(result.Articles) != tc.ExpectedArticlesCount {
				t.Errorf("Article count mismatch: got %d, want %d", len(result.Articles), tc.ExpectedArticlesCount)
			}

			// Verify specific articles if provided
			for _, expectedArticle := range tc.ExpectedArticles {
				articleKey := BuildArticleKey(expectedArticle.Hash)
				found := false
				for _, article := range result.Articles {
					if article == expectedArticle.Hash {
						found = true
						break
					}
				}

				if !found {
					t.Errorf("Expected article %s not found in results", expectedArticle.Hash)
				}

				// Verify article is in Redis sorted set
				score, err := redisClient.ZScore(ctx, keys.ArticlesKey, articleKey).Result()
				if err != nil {
					t.Errorf("Article %s not found in Redis sorted set: %v", articleKey, err)
				} else if int64(score) != expectedArticle.Score {
					t.Errorf("Article score mismatch: got %d, want %d", int64(score), expectedArticle.Score)
				}

				// Verify article is in S3
				_, err = s3Client.HeadObject(ctx, &s3.HeadObjectInput{
					Bucket: aws.String(bucket),
					Key:    aws.String(expectedArticle.Hash + ".json"),
				})
				if err != nil {
					t.Errorf("Article %s not found in S3: %v", expectedArticle.Hash, err)
				}
			}
		})
	}
}

func TestFeedGetCaching(t *testing.T) {
	ctx := context.Background()

	// Setup clients
	redisClient, err := setupRedisClient()
	if err != nil {
		t.Fatalf("Failed to setup Redis client: %v", err)
	}
	defer redisClient.Close()

	s3Client, err := setupS3Client()
	if err != nil {
		t.Fatalf("Failed to setup S3 client: %v", err)
	}

	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "feedreader2018-articles"
	}

	// Load feed fixture
	feedData, err := os.ReadFile("../testdata/feeds/xkcd.atom.xml")
	if err != nil {
		t.Fatalf("Failed to read feed fixture: %v", err)
	}

	requestCount := 0
	lastModified := "Wed, 09 Oct 2024 12:00:00 GMT"
	etag := "\"test-etag-123\""

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		// On second request, check for caching headers and return 304
		if requestCount > 1 {
			if r.Header.Get("If-Modified-Since") != lastModified {
				t.Errorf("Expected If-Modified-Since header: %s, got: %s", lastModified, r.Header.Get("If-Modified-Since"))
			}
			if r.Header.Get("If-None-Match") != etag {
				t.Errorf("Expected If-None-Match header: %s, got: %s", etag, r.Header.Get("If-None-Match"))
			}
			w.WriteHeader(http.StatusNotModified)
			return
		}

		// First request returns full feed
		w.Header().Set("Content-Type", "application/xml")
		w.Header().Set("Last-Modified", lastModified)
		w.Header().Set("Etag", etag)
		w.Write(feedData)
	}))
	defer server.Close()

	fg := NewFeedGetter(redisClient, s3Client, bucket)

	// Clear Redis
	keys := BuildRedisKeys(server.URL)
	redisClient.Del(ctx, keys.FeedKey, keys.ArticlesKey)

	// First request
	result1, err := fg.Get(ctx, server.URL)
	if err != nil {
		t.Fatalf("First request failed: %v", err)
	}

	if !result1.Success {
		t.Errorf("First request should succeed")
	}

	if len(result1.Articles) != 3 {
		t.Errorf("Expected 3 articles, got %d", len(result1.Articles))
	}

	// Second request (should use caching)
	result2, err := fg.Get(ctx, server.URL)
	if err != nil {
		t.Fatalf("Second request failed: %v", err)
	}

	if !result2.Success {
		t.Errorf("Second request should succeed")
	}

	if result2.StatusCode != http.StatusNotModified {
		t.Errorf("Expected 304 Not Modified, got %d", result2.StatusCode)
	}

	if len(result2.Articles) != 3 {
		t.Errorf("Expected 3 articles from cache, got %d", len(result2.Articles))
	}
}
