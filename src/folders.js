import redis from 'redis';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

function get(req, res) {
  const folders = [];
  const prefixLength = 8 + req.params.user.length;
  redisClient.smembers(`folders:${req.params.user}`, (e, allFolders) => {
    if (e) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: `Couldn't get folders for ${req.params.user}`,
        },
      });
    } else if (req.query.xmlurl) {
      allFolders.forEach((folder, folderPosition) => {
        redisClient.sismember(folder, `feed:${req.query.xmlurl}`, (ismemberErr, membership) => {
          if (ismemberErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't get rank of feed:${req.query.xmlurl} in ${folder}`,
              },
            });
          } else {
            if (membership) folders.push(folder);
            if (folderPosition === allFolders.length - 1) {
              res.json({
                success: true,
                folders: folders.map(key => key.substr(prefixLength)),
                allFolders: allFolders.map(key => key.substr(prefixLength)),
              });
            }
          }
        });
      });
    } else {
      res.json({
        success: true,
        folders: allFolders.map(key => key.substr(prefixLength)),
      });
    }
  });
}

const folder = {
  get: (req, res) => {
    redisClient.smembers(`folder:${req.params.user}/${req.params.folder}`, (e, feedkeys) => {
      const feedurls = feedkeys.map(key => key.substr(5));
      const unionkeys = feedurls.map(key => `articles:${key}`);
      const feeds = [];

      if (e) {
        res.status(500).json({
          success: false,
          error: {
            type: 'Redis Error',
            message: `Couldn't get feeds from folder:${req.params.user}/${req.params.folder}`,
          },
        });
      } else {
        const key = `articles:${req.params.user}/${req.params.folder}`;
        const args = [key, unionkeys.length].concat(unionkeys);
        redisClient.zunionstore(args, (unionStoreErr) => {
          if (unionStoreErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't create article list for ${req.params.user}/${req.params.folder}`,
              },
            });
          } else {
            redisClient.zrevrange(key, 0, -1, (revrangeErr, articlekeys) => {
              if (revrangeErr) {
                res.status(500).json({
                  success: false,
                  error: {
                    type: 'Redis Error',
                    message: `Couldn't get article list for ${req.params.user}/${req.params.folder}`,
                  },
                });
              } else {
                redisClient.del(`articles:${req.params.user}/${req.params.folder}`, (delErr) => {
                  if (delErr) {
                    res.status(500).json({
                      success: false,
                      error: {
                        type: 'Redis Error',
                        message: `Couldn't delete article list for ${req.params.user}`,
                      },
                    });
                  } else {
                    feedurls.forEach((feedurl, feedurlPosition) => {
                      const errors = [];
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
                        if (feedurlPosition === feedurls.length - 1) {
                          const articles = articlekeys.map(k => k.substr(8));
                          res.json({
                            success: true,
                            feeds,
                            articles,
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
  },

  post: (req, res) => {
    if (!req.body.xmlurl) {
      res.status(400).json({
        success: false,
        error: {
          type: 'Missing Parameter Error',
          message: 'xmlurl is required',
        },
      });
    } else {
      redisClient.hsetnx(`feed:${req.body.xmlurl}`, 'key', req.body.xmlurl, (e) => {
        if (e) {
          res.status(500).json({
            success: false,
            error: {
              type: 'Redis Error',
              message: `Couldn't save key for feed:${req.body.xmlurl}`,
            },
          });
        } else {
          const folderKey = `folder:${req.user}/${req.params.folder}`;
          redisClient.sadd(folderKey, `feed:${req.body.xmlurl}`, (addFeedErr) => {
            if (addFeedErr) {
              res.status(500).json({
                success: false,
                error: {
                  type: 'Redis Error',
                  message: `Couldn't add ${req.body.xmlurl} to ${folderKey}`,
                },
              });
            } else {
              redisClient.sadd(`folders:${req.user}`, folderKey, (addFolderErr) => {
                if (addFolderErr) {
                  res.status(500).json({
                    success: false,
                    error: {
                      type: 'Redis Error',
                      message: `Couldn't add ${folderKey} to folders:${req.user}`,
                    },
                  });
                } else {
                  res.json({ success: true });
                }
              });
            }
          });
        }
      });
    }
  },

  del: (req, res) => {
    const folderKey = `folder:${req.user}/${req.params.folder}`;
    redisClient.srem(folderKey, `feed:${req.body.xmlurl}`, (e) => {
      if (e) {
        res.status(500).json({
          success: false,
          error: {
            type: 'Redis Error',
            message: `Couldn't remove ${req.body.xmlurl} from ${folderKey}`,
          },
        });
      } else {
        redisClient.scard(folderKey, (scardErr, size) => {
          if (scardErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't check if ${folderKey} is empty`,
              },
            });
          } else if (size === 0) {
            redisClient.srem(`folders:${req.user}`, folderKey, (sremErr) => {
              if (sremErr) {
                res.status(500).json({
                  success: false,
                  error: {
                    type: 'Redis Error',
                    message: `Couldn't remove ${folderKey} from folders:${req.user}`,
                  },
                });
              } else {
                redisClient.del(folderKey, (delErr) => {
                  if (delErr) {
                    res.status(500).json({
                      success: false,
                      error: {
                        type: 'Redis Error',
                        message: `Couldn't delete ${folderKey}`,
                      },
                    });
                  } else {
                    res.json({ success: true });
                  }
                });
              }
            });
          } else {
            res.json({ success: true });
          }
        });
      }
    });
  },
};

export default { get, folder };
