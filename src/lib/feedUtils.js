// Utility functions for feed processing
// These functions are extracted from feeds.js to make them testable

// Redis key prefixes - used for building and parsing keys
const REDIS_FEED_PREFIX = 'feed:';
const REDIS_ARTICLES_PREFIX = 'articles:';
const REDIS_ARTICLE_PREFIX = 'article:';

/**
 * Builds request headers for conditional GET requests
 * @param {Object} storedFeed - Feed metadata from Redis
 * @param {string} storedFeed.lastModified - Last-Modified header from previous fetch
 * @param {string} storedFeed.etag - ETag header from previous fetch
 * @returns {Object} Headers object for HTTP request
 */
export function buildRequestHeaders(storedFeed = {}) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
  };

  if (storedFeed.lastModified) {
    headers['If-Modified-Since'] = storedFeed.lastModified;
  }

  if (storedFeed.etag) {
    headers['If-None-Match'] = storedFeed.etag;
  }

  return headers;
}

/**
 * Builds Redis key names for a feed
 * @param {string} feedURI - The feed URL
 * @returns {Object} Object containing feedKey and articlesKey
 */
export function buildRedisKeys(feedURI) {
  return {
    feedKey: `${REDIS_FEED_PREFIX}${feedURI}`,
    articlesKey: `${REDIS_ARTICLES_PREFIX}${feedURI}`,
  };
}

/**
 * Builds the article key for Redis sorted set
 * @param {string} hash - Article hash
 * @returns {string} Article key in format "article:{hash}"
 */
export function buildArticleKey(hash) {
  return `${REDIS_ARTICLE_PREFIX}${hash}`;
}

/**
 * Processes an article by adding computed fields
 * @param {Object} article - Raw article from feed parser
 * @param {string} feedURI - The feed URL
 * @param {Function} hashFn - Hash function from articles.js
 * @param {Function} scoreFn - Score function from articles.js
 * @returns {Object} Article with hash, score, and feedurl added
 */
export function processArticle(article, feedURI, hashFn, scoreFn) {
  const processed = { ...article };
  processed.hash = hashFn(article);
  processed.score = scoreFn(article);
  processed.feedurl = feedURI;
  return processed;
}

/**
 * Determines if an article should be stored in S3
 * @param {number|null} oldScore - Existing score from Redis (null if new)
 * @param {number} newScore - New score for the article
 * @returns {boolean} True if article should be stored in S3
 */
export function shouldStoreArticle(oldScore, newScore) {
  // Store if:
  // 1. Article is new (oldScore is null)
  // 2. Score has changed (article was updated)
  // Note: parseInt(oldScore, 10) - the radix (10) ensures decimal parsing
  // and prevents edge cases where strings starting with 0 are parsed as octal
  return (oldScore === null) || (newScore !== parseInt(oldScore, 10));
}

/**
 * Validates that an article has required fields
 * @param {Object} article - Article to validate
 * @returns {boolean} True if article is valid
 */
export function isValidArticle(article) {
  // Using !! to convert truthy value to boolean explicitly
  // This is equivalent to: !(!article || !article.guid || !article.description)
  // but more concise. The && operator short-circuits, so if article is null/undefined,
  // it won't try to access article.guid or article.description
  return !!(article && article.guid && article.description);
}

/**
 * Extracts article IDs from Redis keys
 * @param {string[]} articleKeys - Array of article keys like "article:hash123"
 * @returns {string[]} Array of hashes
 */
export function extractArticleIds(articleKeys) {
  const prefixLength = REDIS_ARTICLE_PREFIX.length;
  return articleKeys.map(key => key.substring(prefixLength));
}

/**
 * Generates JSON body for S3 storage
 * @param {Object} article - Processed article with all fields
 * @returns {string} JSON string representation of article
 */
export function generateArticleBody(article) {
  return JSON.stringify(article);
}

export { REDIS_FEED_PREFIX, REDIS_ARTICLES_PREFIX, REDIS_ARTICLE_PREFIX };
