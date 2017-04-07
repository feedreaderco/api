import redis from 'redis';
import FeedParser from 'feedparser';
import request from 'request';
import AWS from 'aws-sdk';
import { hash, score } from './articles.js';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

function get(req, res) {
  redisClient.smembers(`folders:${req.params.user}`, (e, folders) => {
    const feeds = [];
    if (e) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: `Couldn't get folders for ${req.params.user}`,
        },
      });
    } else {
      redisClient.sunion(folders, (sunionErr, feedkeys) => {
        if (sunionErr) {
          res.status(500).json({
            success: false,
            error: {
              type: 'Redis Error',
              message: `Couldn't get feeds from all folders for ${req.params.user}`,
            },
          });
        } else {
          const articlesKey = `articles:${req.params.user}`;
          const readLabel = `label:${req.params.user}/read`;
          const feedurls = feedkeys.map(key => key.substr(5));
          const unionkeys = feedurls.map(key => `articles:${key}`).concat(readLabel);
          const weights = feedurls.map(() => -1).concat(1);
          const args = [
            articlesKey,
            unionkeys.length,
          ].concat(unionkeys, 'weights', weights, 'aggregate', 'max');

          redisClient.zunionstore(args, (unionstoreErr) => {
            if (unionstoreErr) {
              res.status(500).json({
                success: false,
                error: {
                  type: 'Redis Error',
                  message: `Couldn't create article list for ${req.params.user}`,
                  log: unionstoreErr.message,
                },
              });
            } else {
              redisClient.zrangebyscore(articlesKey, '-inf', '0', (zrangeErr, articles) => {
                if (zrangeErr) {
                  res.status(500).json({
                    success: false,
                    error: {
                      type: 'Redis Error',
                      message: `Couldn't get article list for ${req.params.user}`,
                    },
                  });
                } else {
                  redisClient.del(articlesKey, (delErr) => {
                    if (delErr) {
                      res.status(500).json({
                        success: false,
                        error: {
                          type: 'Redis Error',
                          message: `Couldn't delete article list for ${req.params.user}`,
                        },
                      });
                    } else {
                      const errors = [];
                      feedurls.forEach((feedurl, feedurlPosition) => {
                        redisClient.hgetall(`feed:${feedurl}`, (hgetallErr, storedFeed = {}) => {
                          if (hgetallErr) {
                            errors.push({
                              type: 'Redis Error',
                              message: `Couldn't get feed and articles for feed:${feedurl}`,
                            });
                          }
                          const feed = storedFeed;
                          feed.key = feedurl;
                          feeds.push(feed);
                          const articleIDs = articles.map(key => key.substr(8));
                          if (feedurlPosition === feedurls.length - 1) {
                            res.json({
                              success: true,
                              articles: articleIDs,
                              feeds,
                              errors,
                            });
                          }
                        });
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
}

const feed = {
  get: (req, res) => {
    const params = { Bucket: 'feedreader2017-articles' };
    const s3 = new AWS.S3({ params });
    const feedURI = decodeURIComponent(req.url.slice(10));
    const feedKey = `feed:${feedURI}`;
    const articlesKey = `articles:${feedURI}`;

    redisClient.hgetall(feedKey, (e, storedFeed) => {
      let fetchedFeed = {};
      if ((!e) && storedFeed) fetchedFeed = storedFeed;
      const headers = {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
      };
      if (fetchedFeed.lastModified) headers['If-Modified-Since'] = fetchedFeed.lastModified;
      if (fetchedFeed.etag) headers['If-None-Match'] = fetchedFeed.etag;

      const requ = request({
        uri: feedURI,
        headers,
      }, (requestErr, response) => {
        if (requestErr) {
          res.status(500).json({
            success: false,
            error: {
              type: 'Feed Error',
              message: `Couldn't get ${feedURI} (${requestErr.message})`,
              log: e,
            },
          });
        } else {
          const lastModified = response.headers['last-modified'] || '';
          const etag = response.headers.etag || '';
          redisClient.hmset(feedKey, 'lastModified', lastModified, 'etag', etag, (hmsetErr) => {
            if (hmsetErr) {
              res.status(500).json({
                success: false,
                error: {
                  type: 'Redis Error',
                  message: `Couldn't set lastModified and etag values for ${feedURI}`,
                },
              });
            }
          });
        }
      });
      const options = {};
      if (fetchedFeed.link) options.feedurl = fetchedFeed.link;

      const feedparser = new FeedParser(options);
      requ.pipe(feedparser);

      feedparser.on('error', (parseErr) => {
        const err = parseErr;
        if (!err.type) err.type = 'Parser Error';
        if (!parseErr.log) {
          err.log = parseErr.message;
          err.message = 'Couldn\'t parse the server response';
        }
        if (!fetchedFeed.errors) fetchedFeed.errors = [];
        fetchedFeed.errors.push(err);
      });

      feedparser.on('meta', (meta) => {
        redisClient.hmset(feedKey, 'title', meta.title, 'link', meta.link, (hmsetErr) => {
          if (hmsetErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't set title and link values for ${feedURI}`,
              },
            });
          }
        });
      });

      feedparser.on('readable', () => {
        const stream = this;
        for (;;) {
          const article = stream.read();
          if (!article || !article.guid || !article.description) {
            return;
          }
          article.hash = hash(article);
          article.score = score(article);
          article.feedurl = feedURI;

          const body = JSON.stringify(article);
          const key = article.hash;
          const rank = article.score;
          const articleKey = `article:${key}`;

          redisClient.zscore(articlesKey, articleKey, (zscoreErr, oldscore) => {
            if (zscoreErr) {
              const scoreErr = new Error(`Couldn't get score for ${articleKey}`);
              scoreErr.type = 'Redis Error';
              scoreErr.log = zscoreErr.message;
              stream.emit('error', scoreErr);
            } else {
              redisClient.zadd(articlesKey, rank, articleKey, (zaddErr) => {
                if (zaddErr) {
                  const articleAddErr = new Error(`Couldn't add ${articleKey} to ${articlesKey}`);
                  articleAddErr.type = 'Redis Error';
                  articleAddErr.log = zaddErr.message;
                  stream.emit('error', articleAddErr);
                } else if ((oldscore === null) || (rank !== oldscore)) {
                  s3.putObject({
                    Key: key,
                    Body: body,
                    ContentType: 'application/json',
                  }, (s3PutErr) => {
                    if (s3PutErr) {
                      const putErr = new Error(`Couldn't put ${key} in the S3 bucket`);
                      putErr.type = 'S3 Error';
                      putErr.log = s3PutErr.message;
                      stream.emit('error', putErr);
                    }
                  });
                }
              });
            }
          });
        }
      });

      feedparser.on('end', () => {
        redisClient.zrevrange(articlesKey, 0, -1, (rangeErr, allArticles) => {
          if (rangeErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't get articles for ${feedURI}`,
              },
            });
          } else {
            fetchedFeed.success = true;
            fetchedFeed.articles = allArticles.map(key => key.substr(8));
            res.json(fetchedFeed);
          }
        });
      });
    });
  },
};

export default { get, feed };
