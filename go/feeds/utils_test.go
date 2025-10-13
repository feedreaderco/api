package feeds

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"gopkg.in/yaml.v3"
)

type UtilsTestCases struct {
	RequestHeadersTests []struct {
		Description string `yaml:"description"`
		Input       struct {
			LastModified string `yaml:"lastModified"`
			Etag         string `yaml:"etag"`
		} `yaml:"input"`
		Expected map[string]string `yaml:"expected"`
	} `yaml:"request_headers_tests"`

	RedisKeysTests []struct {
		Description string    `yaml:"description"`
		Input       string    `yaml:"input"`
		Expected    RedisKeys `yaml:"expected"`
	} `yaml:"redis_keys_tests"`

	ArticleStorageTests []struct {
		Description string `yaml:"description"`
		Input       struct {
			OldScore *string `yaml:"oldScore"`
			NewScore int64   `yaml:"newScore"`
		} `yaml:"input"`
		Expected bool `yaml:"expected"`
	} `yaml:"article_storage_tests"`

	ArticleValidationTests []struct {
		Description string   `yaml:"description"`
		Input       *Article `yaml:"input"`
		Expected    bool     `yaml:"expected"`
	} `yaml:"article_validation_tests"`
}

func TestBuildRequestHeaders(t *testing.T) {
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.RequestHeadersTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := BuildRequestHeaders(tc.Input.LastModified, tc.Input.Etag)
			if !reflect.DeepEqual(result, tc.Expected) {
				t.Errorf("Headers mismatch:\ngot:  %+v\nwant: %+v", result, tc.Expected)
			}
		})
	}
}

func TestBuildRedisKeys(t *testing.T) {
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.RedisKeysTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := BuildRedisKeys(tc.Input)
			if !reflect.DeepEqual(result, tc.Expected) {
				t.Errorf("Redis keys mismatch:\ngot:  %+v\nwant: %+v", result, tc.Expected)
			}
		})
	}
}

func TestBuildArticleKey(t *testing.T) {
	hashValue := "13a0bebeed5b348147d880a1a4917587"
	result := BuildArticleKey(hashValue)
	expected := RedisArticlePrefix + hashValue
	if result != expected {
		t.Errorf("Article key mismatch: got %s, want %s", result, expected)
	}
}

func TestRedisKeyPrefixConstants(t *testing.T) {
	if RedisFeedPrefix != "feed:" {
		t.Errorf("RedisFeedPrefix: got %s, want feed:", RedisFeedPrefix)
	}
	if RedisArticlesPrefix != "articles:" {
		t.Errorf("RedisArticlesPrefix: got %s, want articles:", RedisArticlesPrefix)
	}
	if RedisArticlePrefix != "article:" {
		t.Errorf("RedisArticlePrefix: got %s, want article:", RedisArticlePrefix)
	}
}

func TestShouldStoreArticle(t *testing.T) {
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.ArticleStorageTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := ShouldStoreArticle(tc.Input.OldScore, tc.Input.NewScore)
			if result != tc.Expected {
				t.Errorf("Storage decision mismatch: got %v, want %v", result, tc.Expected)
			}
		})
	}
}

func TestIsValidArticle(t *testing.T) {
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.ArticleValidationTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := IsValidArticle(tc.Input)
			if result != tc.Expected {
				t.Errorf("Validation mismatch: got %v, want %v", result, tc.Expected)
			}
		})
	}
}

func TestProcessArticle(t *testing.T) {
	article := Article{
		GUID:    "https://xkcd.com/3153/",
		Title:   "Test Article",
		PubDate: "2024-10-10T00:00:00Z",
	}
	feedURI := "https://xkcd.com/atom.xml"

	result := ProcessArticle(article, feedURI)

	if result.Hash != "13a0bebeed5b348147d880a1a4917587" {
		t.Errorf("Hash mismatch: got %s", result.Hash)
	}
	if result.Score != 1728518400000 {
		t.Errorf("Score mismatch: got %d", result.Score)
	}
	if result.FeedURL != feedURI {
		t.Errorf("FeedURL mismatch: got %s", result.FeedURL)
	}
	if result.GUID != article.GUID {
		t.Errorf("GUID mismatch: got %s", result.GUID)
	}
	if result.Title != article.Title {
		t.Errorf("Title mismatch: got %s", result.Title)
	}
}

func TestExtractArticleIds(t *testing.T) {
	keys := []string{
		"article:13a0bebeed5b348147d880a1a4917587",
		"article:21664da7ee05988c62d1f516f3442411",
		"article:3fa08ba1591ba3683e87265ee9300946",
	}

	result := ExtractArticleIds(keys)

	expected := []string{
		"13a0bebeed5b348147d880a1a4917587",
		"21664da7ee05988c62d1f516f3442411",
		"3fa08ba1591ba3683e87265ee9300946",
	}

	if !reflect.DeepEqual(result, expected) {
		t.Errorf("ExtractArticleIds mismatch:\ngot:  %+v\nwant: %+v", result, expected)
	}
}

func TestGenerateArticleBody(t *testing.T) {
	article := Article{
		GUID:  "test-guid",
		Title: "Test Article",
		Hash:  "abc123",
		Score: 1234567890,
	}

	result, err := GenerateArticleBody(article)
	if err != nil {
		t.Fatalf("GenerateArticleBody failed: %v", err)
	}

	var parsed Article
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("Failed to parse generated JSON: %v", err)
	}

	if parsed.GUID != article.GUID || parsed.Title != article.Title ||
		parsed.Hash != article.Hash || parsed.Score != article.Score {
		t.Errorf("Parsed article doesn't match original:\ngot:  %+v\nwant: %+v", parsed, article)
	}
}
