// Pure utility functions for article processing (no external dependencies)
// These can be tested without AWS or Redis

const crypto = require('crypto');

/**
 * Generates MD5 hash of article GUID
 * Reference: api/src/articles.js hash() function
 * @param {Object} article - Article object with guid field
 * @returns {string} MD5 hash in hex format
 */
function hash(article) {
  return crypto.createHash('md5').update(article.guid).digest('hex');
}

/**
 * Generates score (timestamp) for article
 * Reference: api/src/articles.js score() function
 * @param {Object} article - Article object with date fields
 * @returns {number} Unix timestamp in milliseconds
 */
function score(article) {
  const articleDate = article.pubDate || article.pubdate || article.date;
  const articleScore = Date.parse(articleDate) || Date.now();
  return articleScore;
}

module.exports = { hash, score };
