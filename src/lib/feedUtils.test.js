// Tests for feed utility functions
// Run with: node src/lib/feedUtils.test.js

const feedUtils = require('./feedUtils.js');
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
console.log('\n=== Testing Feed Utility Functions ===\n');

// Test buildRequestHeaders
testCases.request_headers_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.buildRequestHeaders(testCase.input);
    assert.deepStrictEqual(result, testCase.expected,
      `Headers mismatch: got ${JSON.stringify(result)}, expected ${JSON.stringify(testCase.expected)}`);
  });
});

// Test buildRedisKeys
testCases.redis_keys_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.buildRedisKeys(testCase.input);
    assert.deepStrictEqual(result, testCase.expected,
      `Redis keys mismatch: got ${JSON.stringify(result)}, expected ${JSON.stringify(testCase.expected)}`);
  });
});

// Test buildArticleKey
testCases.build_article_key_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.buildArticleKey(testCase.input);
    assert.strictEqual(result, testCase.expected,
      `Article key mismatch: got ${result}, expected ${testCase.expected}`);
  });
});

// Test Redis key prefix constants
testCases.redis_key_prefix_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const constantValue = feedUtils[testCase.key];
    assert.strictEqual(constantValue, testCase.expected,
      `${testCase.key} mismatch: got ${constantValue}, expected ${testCase.expected}`);
  });
});

// Test shouldStoreArticle
testCases.article_storage_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.shouldStoreArticle(
      testCase.input.oldScore,
      testCase.input.newScore
    );
    assert.strictEqual(result, testCase.expected,
      `Storage decision mismatch: got ${result}, expected ${testCase.expected}`);
  });
});

// Test isValidArticle
testCases.article_validation_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.isValidArticle(testCase.input);
    assert.strictEqual(result, testCase.expected,
      `Validation mismatch: got ${result}, expected ${testCase.expected}`);
  });
});

// Test processArticle
testCases.process_article_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.processArticle(
      testCase.input.article,
      testCase.input.feedURI,
      hash,
      score
    );

    assert.strictEqual(result.hash, testCase.expected.hash,
      `Hash mismatch: got ${result.hash}, expected ${testCase.expected.hash}`);
    assert.strictEqual(result.score, testCase.expected.score,
      `Score mismatch: got ${result.score}, expected ${testCase.expected.score}`);
    assert.strictEqual(result.feedurl, testCase.expected.feedurl,
      `FeedURL mismatch: got ${result.feedurl}, expected ${testCase.expected.feedurl}`);
    assert.strictEqual(result.guid, testCase.expected.guid,
      `GUID mismatch: got ${result.guid}, expected ${testCase.expected.guid}`);
    assert.strictEqual(result.title, testCase.expected.title,
      `Title mismatch: got ${result.title}, expected ${testCase.expected.title}`);
  });
});

// Test extractArticleIds
testCases.extract_article_ids_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.extractArticleIds(testCase.input);
    assert.deepStrictEqual(result, testCase.expected,
      `Article IDs mismatch: got ${JSON.stringify(result)}, expected ${JSON.stringify(testCase.expected)}`);
  });
});

// Test generateArticleBody
testCases.generate_article_body_tests.forEach((testCase) => {
  test(testCase.description, () => {
    const result = feedUtils.generateArticleBody(testCase.input);
    const parsed = JSON.parse(result);

    // Verify it produces valid JSON and round-trips correctly
    assert.deepStrictEqual(parsed, testCase.input,
      `Article body mismatch: got ${JSON.stringify(parsed)}, expected ${JSON.stringify(testCase.input)}`);
  });
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
