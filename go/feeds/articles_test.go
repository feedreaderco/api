package feeds

import (
	"os"
	"testing"

	"gopkg.in/yaml.v3"
)

type TestCases struct {
	HashFunctionTests []struct {
		Description string `yaml:"description"`
		Input       struct {
			GUID string `yaml:"guid"`
		} `yaml:"input"`
		Expected string `yaml:"expected"`
	} `yaml:"hash_function_tests"`

	ScoreFunctionTests []struct {
		Description  string `yaml:"description"`
		Input        Article `yaml:"input"`
		Expected     int64  `yaml:"expected"`
		ExpectedType string `yaml:"expected_type"`
	} `yaml:"score_function_tests"`
}

func TestHash(t *testing.T) {
	// Load test cases from YAML
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases TestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.HashFunctionTests {
		t.Run(tc.Description, func(t *testing.T) {
			article := Article{GUID: tc.Input.GUID}
			result := Hash(article)
			if result != tc.Expected {
				t.Errorf("Hash mismatch: got %s, expected %s", result, tc.Expected)
			}
		})
	}
}

func TestScore(t *testing.T) {
	// Load test cases from YAML
	data, err := os.ReadFile("../../testdata/test-cases.yaml")
	if err != nil {
		t.Fatalf("Failed to read test data: %v", err)
	}

	var testCases TestCases
	if err := yaml.Unmarshal(data, &testCases); err != nil {
		t.Fatalf("Failed to parse test data: %v", err)
	}

	for _, tc := range testCases.ScoreFunctionTests {
		t.Run(tc.Description, func(t *testing.T) {
			result := Score(tc.Input)
			if tc.ExpectedType == "timestamp" {
				// For invalid dates that fallback to time.Now(), just check it's positive
				if result <= 0 {
					t.Errorf("Score should be positive: got %d", result)
				}
			} else {
				if result != tc.Expected {
					t.Errorf("Score mismatch: got %d, expected %d", result, tc.Expected)
				}
			}
		})
	}
}
