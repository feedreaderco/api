// Tests for article utility functions (hash and score)
// Run with: node src/lib/articleUtils.test.js

const { hash, score } = require('./articleUtils.js');
const fs = require('fs');
const yaml = require('js-yaml');
const assert = require('assert');

// Load test cases from YAML
const testCasesYaml = fs.readFileSync('./testdata/test-cases.yaml', 'utf8');
const testCases = yaml.load(testCasesYaml);

// Simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

// Run all tests
console.log('\n=== Testing Article Utility Functions ===\n');

// Test hash function
testCases.hash_function_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = hash(testCase.input);
    assert.strictEqual(result, testCase.expected,
      `Hash mismatch: got ${result}, expected ${testCase.expected}`);
  });
});

// Test score function
testCases.score_function_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = score(testCase.input);
    if (testCase.expected_type === 'timestamp') {
      // For invalid dates that fallback to Date.now(), just check it's a number
      assert.strictEqual(typeof result, 'number',
        `Score should be a number: got ${typeof result}`);
      assert.ok(result > 0, `Score should be positive: got ${result}`);
    } else {
      assert.strictEqual(result, testCase.expected,
        `Score mismatch: got ${result}, expected ${testCase.expected}`);
    }
  });
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
