// Integration tests for feed fetching
// Run with: INTEGRATION=true node src/lib/feeds.integration.test.js
// Requires Redis and MinIO to be running (use docker-compose up)

const fs = require('fs');
const http = require('http');
const yaml = require('js-yaml');
const redis = require('redis');
const AWS = require('aws-sdk');

// Exit if not running in integration mode
if (process.env.INTEGRATION !== 'true') {
  console.log('Skipping integration tests (set INTEGRATION=true to run)');
  process.exit(0);
}

// Load test cases from YAML
const testCasesYaml = fs.readFileSync('./testdata/feed-get-tests.yaml', 'utf8');
const testCases = yaml.load(testCasesYaml);

// Setup Redis client
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
});

// Setup S3 client (MinIO)
const s3Endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
const s3AccessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
const s3SecretKey = process.env.S3_SECRET_KEY || 'minioadmin';
const s3Bucket = process.env.S3_BUCKET || 'feedreader2018-articles';

AWS.config.update({
  accessKeyId: s3AccessKey,
  secretAccessKey: s3SecretKey,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

const s3 = new AWS.S3({
  endpoint: s3Endpoint,
  params: { Bucket: s3Bucket },
});

// Import feed utilities
const { buildRedisKeys, buildArticleKey, extractArticleIds } = require('./feedUtils.js');

// Simple test runner
let passed = 0;
let failed = 0;
let testServer = null;

function test(name, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        passed++;
        console.log(`✓ ${name}`);
        resolve();
      })
      .catch((error) => {
        failed++;
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        if (error.stack) {
          console.error(`  ${error.stack}`);
        }
        resolve();
      });
  });
}

// Helper to create a mock feed.get wrapper that doesn't require Express
function createFeedFetcher(feedURI, redisClient, s3Client) {
  const request = require('request');
  const FeedParser = require('feedparser');
  const { buildRequestHeaders, isValidArticle, processArticle, shouldStoreArticle, generateArticleBody } = require('./feedUtils.js');
  const { hash, score } = require('./articleUtils.js');

  return new Promise((resolve, reject) => {
    const { feedKey, articlesKey } = buildRedisKeys(feedURI);
    const result = {
      success: false,
      articles: [],
    };

    redisClient.hgetall(feedKey, (e, storedFeed) => {
      let fetchedFeed = storedFeed || {};
      const headers = buildRequestHeaders(fetchedFeed);

      const requ = request({
        uri: feedURI,
        headers,
      }, (requestErr, response) => {
        if (requestErr) {
          result.success = false;
          result.error = requestErr.message;
          return reject(new Error(requestErr.message));
        }

        const lastModified = response.headers['last-modified'] || '';
        const etag = response.headers.etag || '';
        result.statusCode = response.statusCode;

        if (response.statusCode === 304) {
          // Not modified, return cached articles
          redisClient.zrevrange(articlesKey, 0, -1, (rangeErr, allArticles) => {
            if (rangeErr) return reject(rangeErr);
            result.success = true;
            result.articles = extractArticleIds(allArticles);
            result.title = fetchedFeed.title;
            result.link = fetchedFeed.link;
            result.lastModified = fetchedFeed.lastModified;
            result.etag = fetchedFeed.etag;
            resolve(result);
          });
          return;
        }

        redisClient.hmset(feedKey, 'lastModified', lastModified, 'etag', etag, (hmsetErr) => {
          if (hmsetErr) return reject(hmsetErr);
        });
      });

      const options = {};
      if (fetchedFeed.link) options.feedurl = fetchedFeed.link;

      const feedparser = new FeedParser(options);
      requ.pipe(feedparser);

      feedparser.on('error', (parseErr) => {
        result.success = false;
        result.error = parseErr.message;
        reject(parseErr);
      });

      feedparser.on('meta', (meta) => {
        result.title = meta.title;
        result.link = meta.link;
        redisClient.hmset(feedKey, 'title', meta.title, 'link', meta.link, (hmsetErr) => {
          if (hmsetErr) reject(hmsetErr);
        });
      });

      feedparser.on('readable', function() {
        const stream = this;
        for (;;) {
          const article = stream.read();
          if (!isValidArticle(article)) {
            return;
          }

          const processedArticle = processArticle(article, feedURI, hash, score);
          const key = processedArticle.hash;
          const rank = processedArticle.score;
          const articleKey = buildArticleKey(key);

          redisClient.zscore(articlesKey, articleKey, (zscoreErr, oldscore) => {
            if (zscoreErr) return;

            redisClient.zadd(articlesKey, rank, articleKey, (zaddErr) => {
              if (zaddErr) return;

              if (shouldStoreArticle(oldscore, rank)) {
                const body = generateArticleBody(processedArticle);
                s3Client.putObject({
                  Key: key + '.json',
                  Body: body,
                  ContentType: 'application/json',
                }, (s3PutErr) => {
                  if (s3PutErr) console.error('S3 error:', s3PutErr);
                });
              }
            });
          });
        }
      });

      feedparser.on('end', () => {
        redisClient.zrevrange(articlesKey, 0, -1, (rangeErr, allArticles) => {
          if (rangeErr) return reject(rangeErr);
          result.success = true;
          result.articles = extractArticleIds(allArticles);
          resolve(result);
        });
      });
    });
  });
}

// Helper to clear Redis keys
function clearRedisKeys(feedURI, callback) {
  const { feedKey, articlesKey } = buildRedisKeys(feedURI);
  redisClient.del([feedKey, articlesKey], callback);
}

// Run all integration tests
async function runTests() {
  console.log('\n=== Testing Feed Fetching (Integration) ===\n');

  // Test: Fetch and process Atom feed
  const atomTest = testCases.feed_get_tests.find(tc => tc.description.includes('Atom'));
  if (atomTest) {
    await test(atomTest.description, () => {
      return new Promise((resolve, reject) => {
        // Clear Redis
        clearRedisKeys('http://localhost:8888/xkcd', (clearErr) => {
          if (clearErr) return reject(clearErr);

          // Read feed fixture
          const feedData = fs.readFileSync(atomTest.feed_fixture, 'utf8');

          // Create test HTTP server
          testServer = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(feedData);
          });

          testServer.listen(8888, async () => {
            try {
              const result = await createFeedFetcher('http://localhost:8888/xkcd', redisClient, s3);

              // Verify success
              if (!result.success) {
                throw new Error(`Expected success=true, got ${result.success}`);
              }

              // Verify feed metadata
              if (result.title !== atomTest.expected_feed_metadata.title) {
                throw new Error(`Title mismatch: got ${result.title}, want ${atomTest.expected_feed_metadata.title}`);
              }

              if (result.link !== atomTest.expected_feed_metadata.link) {
                throw new Error(`Link mismatch: got ${result.link}, want ${atomTest.expected_feed_metadata.link}`);
              }

              // Verify article count
              if (result.articles.length !== atomTest.expected_articles_count) {
                throw new Error(`Article count mismatch: got ${result.articles.length}, want ${atomTest.expected_articles_count}`);
              }

              // Verify specific articles
              for (const expectedArticle of atomTest.expected_articles) {
                if (!result.articles.includes(expectedArticle.hash)) {
                  throw new Error(`Expected article ${expectedArticle.hash} not found`);
                }

                // Verify article is in Redis
                const { articlesKey } = buildRedisKeys('http://localhost:8888/xkcd');
                const articleKey = buildArticleKey(expectedArticle.hash);

                await new Promise((res, rej) => {
                  redisClient.zscore(articlesKey, articleKey, (err, score) => {
                    if (err) return rej(err);
                    if (parseInt(score) !== expectedArticle.score) {
                      return rej(new Error(`Score mismatch: got ${score}, want ${expectedArticle.score}`));
                    }
                    res();
                  });
                });

                // Verify article is in S3
                await new Promise((res, rej) => {
                  s3.headObject({ Key: expectedArticle.hash + '.json' }, (err) => {
                    if (err) return rej(new Error(`Article ${expectedArticle.hash} not found in S3`));
                    res();
                  });
                });
              }

              testServer.close();
              resolve();
            } catch (error) {
              testServer.close();
              reject(error);
            }
          });
        });
      });
    });
  }

  // Test: Fetch and process RSS feed
  const rssTest = testCases.feed_get_tests.find(tc => tc.description.includes('RSS'));
  if (rssTest) {
    await test(rssTest.description, () => {
      return new Promise((resolve, reject) => {
        clearRedisKeys('http://localhost:8889/hn', (clearErr) => {
          if (clearErr) return reject(clearErr);

          const feedData = fs.readFileSync(rssTest.feed_fixture, 'utf8');

          testServer = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(feedData);
          });

          testServer.listen(8889, async () => {
            try {
              const result = await createFeedFetcher('http://localhost:8889/hn', redisClient, s3);

              if (!result.success) {
                throw new Error(`Expected success=true, got ${result.success}`);
              }

              if (result.title !== rssTest.expected_feed_metadata.title) {
                throw new Error(`Title mismatch: got ${result.title}, want ${rssTest.expected_feed_metadata.title}`);
              }

              if (result.articles.length !== rssTest.expected_articles_count) {
                throw new Error(`Article count mismatch: got ${result.articles.length}, want ${rssTest.expected_articles_count}`);
              }

              testServer.close();
              resolve();
            } catch (error) {
              testServer.close();
              reject(error);
            }
          });
        });
      });
    });
  }

  // Print summary
  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  redisClient.quit();
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  if (testServer) testServer.close();
  redisClient.quit();
  process.exit(1);
});
