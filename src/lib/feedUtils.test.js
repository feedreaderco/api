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
    assert.strictEqual(result, testCase.expected,
      `Score mismatch: got ${result}, expected ${testCase.expected}`);
  });
});

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
test('buildArticleKey creates correct format', () => {
  const hashValue = '13a0bebeed5b348147d880a1a4917587';
  const result = feedUtils.buildArticleKey(hashValue);
  assert.strictEqual(result, `${feedUtils.REDIS_ARTICLE_PREFIX}${hashValue}`);
});

// Test Redis key prefix constants
test('Redis prefix constants are defined', () => {
  assert.strictEqual(feedUtils.REDIS_FEED_PREFIX, 'feed:');
  assert.strictEqual(feedUtils.REDIS_ARTICLES_PREFIX, 'articles:');
  assert.strictEqual(feedUtils.REDIS_ARTICLE_PREFIX, 'article:');
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
test('processArticle adds hash, score, and feedurl', () => {
  const article = {
    guid: 'https://xkcd.com/3153/',
    title: 'Test Article',
    pubDate: '2025-10-10T00:00:00Z',
  };
  const feedURI = 'https://xkcd.com/atom.xml';

  const result = feedUtils.processArticle(article, feedURI, hash, score);

  assert.strictEqual(result.hash, '13a0bebeed5b348147d880a1a4917587');
  assert.strictEqual(result.score, 1760054400000);
  assert.strictEqual(result.feedurl, feedURI);
  assert.strictEqual(result.guid, article.guid);
  assert.strictEqual(result.title, article.title);
});

// Test extractArticleIds
test('extractArticleIds strips article: prefix', () => {
  const keys = [
    'article:13a0bebeed5b348147d880a1a4917587',
    'article:21664da7ee05988c62d1f516f3442411',
    'article:3fa08ba1591ba3683e87265ee9300946',
  ];

  const result = feedUtils.extractArticleIds(keys);

  assert.deepStrictEqual(result, [
    '13a0bebeed5b348147d880a1a4917587',
    '21664da7ee05988c62d1f516f3442411',
    '3fa08ba1591ba3683e87265ee9300946',
  ]);
});

// Test generateArticleBody
test('generateArticleBody produces valid JSON', () => {
  const article = {
    guid: 'test-guid',
    title: 'Test Article',
    hash: 'abc123',
    score: 1234567890,
  };

  const result = feedUtils.generateArticleBody(article);
  const parsed = JSON.parse(result);

  assert.deepStrictEqual(parsed, article);
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
