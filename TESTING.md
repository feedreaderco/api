# Testing Guide for Feed Processing Functions

This document describes the refactored, testable feed processing utilities and how to run tests.

## Overview

The feed processing logic has been extracted into small, testable functions in `src/lib/`:

- **`articleUtils.js`** - Pure functions for article hashing and scoring (no external dependencies)
- **`feedUtils.js`** - Utility functions for feed processing (headers, Redis keys, validation, etc.)

## Running Tests

```bash
node src/lib/feedUtils.test.js
```

All tests use the test data in `testdata/test-cases.json` which contains expected inputs and outputs generated from the actual Node.js implementation.

## Test Coverage

### Article Functions (`articleUtils.js`)

1. **`hash(article)`** - MD5 hash of article GUID
   - Tests: 3 test cases verifying hash consistency
   - Implementation matches `src/articles.js` exactly

2. **`score(article)`** - Unix timestamp score
   - Tests: 3 test cases with different date field names (pubDate, pubdate, date)
   - Implementation matches `src/articles.js` exactly

### Feed Functions (`feedUtils.js`)

1. **`buildRequestHeaders(storedFeed)`** - Builds HTTP headers for conditional GET
   - Tests: 4 test cases (no headers, If-Modified-Since, If-None-Match, both)

2. **`buildRedisKeys(feedURI)`** - Creates Redis key names
   - Tests: 2 test cases with different feed URLs

3. **`buildArticleKey(hash)`** - Creates article key for Redis sorted set
   - Tests: 1 test case verifying format

4. **`processArticle(article, feedURI, hashFn, scoreFn)`** - Adds computed fields
   - Tests: 1 test case verifying hash, score, and feedurl are added

5. **`shouldStoreArticle(oldScore, newScore)`** - Determines if article needs S3 storage
   - Tests: 4 test cases (new article, changed score, unchanged score, type coercion)

6. **`isValidArticle(article)`** - Validates article has required fields
   - Tests: 4 test cases (valid, missing guid, missing description, null)

7. **`extractFeedMetadata(meta)`** - Extracts title and link from parser meta
   - Tests: 1 test case

8. **`extractArticleIds(articleKeys)`** - Strips "article:" prefix from Redis keys
   - Tests: 1 test case

## Test Data Format

The `testdata/test-cases.json` file contains test cases organized by function:

```json
{
  "hash_function_tests": [...],
  "score_function_tests": [...],
  "request_headers_tests": [...],
  ...
}
```

Each test case has:
- `description` - Human-readable test description
- `input` - Input value(s) for the function
- `expected` - Expected output value

## Adding New Tests

1. Add test data to `testdata/test-cases.json`
2. Add corresponding test code in `src/lib/feedUtils.test.js`
3. Run tests to verify

## Future Work

Next steps:
1. Refactor `src/feeds.js` to use these utility functions
2. Add integration tests for Redis and S3 operations
3. Create Go implementation with matching behavior (in `feedfetcher/` directory)
4. Create Go tests that use the same `testdata/test-cases.json` file

## Why These Functions?

These functions were extracted because they are:
1. **Pure or nearly pure** - Deterministic output for given input
2. **Core business logic** - Critical for feed processing correctness
3. **Reusable** - Can be used by both Node.js and Go implementations
4. **Independently testable** - No mocking of Redis/S3 needed

The goal is to ensure both Node.js and Go implementations produce identical results for:
- Article hashing (critical for deduplication)
- Article scoring (critical for sorting)
- Request headers (critical for conditional GET optimization)
- Redis key naming (critical for data storage)
- S3 storage decisions (critical for performance)
