package feedfetcher

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// Redis key prefixes - used for building and parsing keys
const (
	RedisFeedPrefix     = "feed:"
	RedisArticlesPrefix = "articles:"
	RedisArticlePrefix  = "article:"
)

// BuildRequestHeaders builds request headers for conditional GET requests
// Reference: api/src/lib/feedUtils.js buildRequestHeaders() function
func BuildRequestHeaders(lastModified, etag string) map[string]string {
	headers := map[string]string{
		"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36",
	}

	if lastModified != "" {
		headers["If-Modified-Since"] = lastModified
	}

	if etag != "" {
		headers["If-None-Match"] = etag
	}

	return headers
}

// RedisKeys represents Redis key names for a feed
type RedisKeys struct {
	FeedKey     string `json:"feedKey" yaml:"feedKey"`
	ArticlesKey string `json:"articlesKey" yaml:"articlesKey"`
}

// BuildRedisKeys builds Redis key names for a feed
// Reference: api/src/lib/feedUtils.js buildRedisKeys() function
func BuildRedisKeys(feedURI string) RedisKeys {
	return RedisKeys{
		FeedKey:     RedisFeedPrefix + feedURI,
		ArticlesKey: RedisArticlesPrefix + feedURI,
	}
}

// BuildArticleKey builds the article key for Redis sorted set
// Reference: api/src/lib/feedUtils.js buildArticleKey() function
func BuildArticleKey(hash string) string {
	return RedisArticlePrefix + hash
}

// ProcessArticle processes an article by adding computed fields
// Reference: api/src/lib/feedUtils.js processArticle() function
func ProcessArticle(article Article, feedURI string) Article {
	processed := article
	processed.Hash = Hash(article)
	processed.Score = Score(article)
	processed.FeedURL = feedURI
	return processed
}

// ShouldStoreArticle determines if an article should be stored in S3
// Reference: api/src/lib/feedUtils.js shouldStoreArticle() function
func ShouldStoreArticle(oldScore *string, newScore int64) bool {
	// Store if article is new (oldScore is nil)
	if oldScore == nil {
		return true
	}

	// Parse oldScore as int64
	oldScoreInt, err := strconv.ParseInt(*oldScore, 10, 64)
	if err != nil {
		// If parsing fails, treat as different score
		return true
	}

	// Store if score has changed
	return newScore != oldScoreInt
}

// IsValidArticle validates that an article has required fields
// Reference: api/src/lib/feedUtils.js isValidArticle() function
func IsValidArticle(article *Article) bool {
	return article != nil && article.GUID != "" && article.Description != ""
}

// ExtractArticleIds extracts article IDs (hashes) from Redis keys by removing the "article:" prefix
// Reference: api/src/lib/feedUtils.js extractArticleIds() function
func ExtractArticleIds(articleKeys []string) []string {
	prefixLength := len(RedisArticlePrefix)
	ids := make([]string, len(articleKeys))
	for i, key := range articleKeys {
		if len(key) > prefixLength {
			ids[i] = key[prefixLength:]
		} else {
			ids[i] = key
		}
	}
	return ids
}

// GenerateArticleBody generates JSON body for S3 storage
// Reference: api/src/lib/feedUtils.js generateArticleBody() function
func GenerateArticleBody(article Article) (string, error) {
	body, err := json.Marshal(article)
	if err != nil {
		return "", fmt.Errorf("failed to marshal article: %w", err)
	}
	return string(body), nil
}
