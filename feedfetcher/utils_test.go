package feedfetcher

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

	RedisKeyPrefixTests []struct {
		Description string `yaml:"description"`
		Key         string `yaml:"key"`
		Expected    string `yaml:"expected"`
	} `yaml:"redis_key_prefix_tests"`

	BuildArticleKeyTests []struct {
		Description string `yaml:"description"`
		Input       string `yaml:"input"`
		Expected    string `yaml:"expected"`
	} `yaml:"build_article_key_tests"`

	ProcessArticleTests []struct {
		Description string `yaml:"description"`
		Input       struct {
			Article Article `yaml:"article"`
			FeedURI string  `yaml:"feedURI"`
		} `yaml:"input"`
		Expected Article `yaml:"expected"`
	} `yaml:"process_article_tests"`

	ExtractArticleIdsTests []struct {
		Description string   `yaml:"description"`
		Input       []string `yaml:"input"`
		Expected    []string `yaml:"expected"`
	} `yaml:"extract_article_ids_tests"`

	GenerateArticleBodyTests []struct {
		Description  string  `yaml:"description"`
		Input        Article `yaml:"input"`
		ExpectedJSON bool    `yaml:"expected_json"`
	} `yaml:"generate_article_body_tests"`
}

func TestBuildRequestHeaders(t *testing.T) {
	data, err := os.ReadFile("../testdata/test-cases.yaml")
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
	data, err := os.ReadFile("../testdata/test-cases.yaml")
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
	data, err := os.ReadFile("../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.BuildArticleKeyTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := BuildArticleKey(tc.Input)
			if result != tc.Expected {
				t.Errorf("Article key mismatch: got %s, want %s", result, tc.Expected)
			}
		})
	}
}

func TestRedisKeyPrefixConstants(t *testing.T) {
	data, err := os.ReadFile("../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.RedisKeyPrefixTests {
		t.Run(tc.Description, func(t *testing.T) {
			var actual string
			switch tc.Key {
			case "REDIS_FEED_PREFIX":
				actual = RedisFeedPrefix
			case "REDIS_ARTICLES_PREFIX":
				actual = RedisArticlesPrefix
			case "REDIS_ARTICLE_PREFIX":
				actual = RedisArticlePrefix
			default:
				t.Fatalf("Unknown constant key: %s", tc.Key)
			}

			if actual != tc.Expected {
				t.Errorf("%s mismatch: got %s, want %s", tc.Key, actual, tc.Expected)
			}
		})
	}
}

func TestShouldStoreArticle(t *testing.T) {
	data, err := os.ReadFile("../testdata/test-cases.yaml")
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
	data, err := os.ReadFile("../testdata/test-cases.yaml")
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
	data, err := os.ReadFile("../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.ProcessArticleTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := ProcessArticle(tc.Input.Article, tc.Input.FeedURI)

			if result.Hash != tc.Expected.Hash {
				t.Errorf("Hash mismatch: got %s, want %s", result.Hash, tc.Expected.Hash)
			}
			if result.Score != tc.Expected.Score {
				t.Errorf("Score mismatch: got %d, want %d", result.Score, tc.Expected.Score)
			}
			if result.FeedURL != tc.Expected.FeedURL {
				t.Errorf("FeedURL mismatch: got %s, want %s", result.FeedURL, tc.Expected.FeedURL)
			}
			if result.GUID != tc.Expected.GUID {
				t.Errorf("GUID mismatch: got %s, want %s", result.GUID, tc.Expected.GUID)
			}
			if result.Title != tc.Expected.Title {
				t.Errorf("Title mismatch: got %s, want %s", result.Title, tc.Expected.Title)
			}
		})
	}
}

func TestExtractArticleIds(t *testing.T) {
	data, err := os.ReadFile("../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.ExtractArticleIdsTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := ExtractArticleIds(tc.Input)

			if !reflect.DeepEqual(result, tc.Expected) {
				t.Errorf("ExtractArticleIds mismatch:\ngot:  %+v\nwant: %+v", result, tc.Expected)
			}
		})
	}
}

func TestGenerateArticleBody(t *testing.T) {
	data, err := os.ReadFile("../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases UtilsTestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.GenerateArticleBodyTests {
		t.Run(tc.Description, func(t *testing.T) {
			result, err := GenerateArticleBody(tc.Input)
			if err != nil {
				t.Fatalf("GenerateArticleBody failed: %v", err)
			}

			var parsed Article
			if err := json.Unmarshal([]byte(result), &parsed); err != nil {
				t.Fatalf("Failed to parse generated JSON: %v", err)
			}

			// Verify round-trip
			if parsed.GUID != tc.Input.GUID || parsed.Title != tc.Input.Title ||
				parsed.Hash != tc.Input.Hash || parsed.Score != tc.Input.Score {
				t.Errorf("Parsed article doesn't match original:\ngot:  %+v\nwant: %+v", parsed, tc.Input)
			}
		})
	}
}
