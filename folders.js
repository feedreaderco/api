require('dotenv').config();
var redis = require('redis').createClient({host: process.env.REDIS_HOST});

exports.get = function(req,res) {
  var folders = [];
  redis.smembers('folders:' + req.params.user, function(e, allFolders) {
    if (e) {
      res.status(500).json({
        'success': false,
        'error': {
          'type': 'Redis Error',
          'message': "Couldn't get folders for " + req.params.user
        }
      });
    } else if (req.query.xmlurl) {
      allFolders.forEach(function(folder, folderPosition) {
        redis.sismember(folder, 'feed:' + req.query.xmlurl, function(e, membership) {
          if (e) {
            res.status(500).json({
              'success': false,
              'error': {
                'type': 'Redis Error',
                'message': "Couldn't get rank of feed:" + req.query.xmlurl + " in " + folder
              }
            });
          } else {
            if (membership) folders.push(folder);
            if (folderPosition === allFolders.length - 1) {
              res.json({
                'success': true,
                'folders': folders.map(function(key) {
                  return key.substr(8 + req.params.user.length);
                }),
                'allFolders': allFolders.map(function(key) {
                  return key.substr(8 + req.params.user.length);
                })
              });
            }
          }
        });
      });
    } else {
      res.json({
        'success': true,
        'folders': allFolders.map(function(key) {
          return key.substr(8 + req.params.user.length);
        })
      });
    }
  });
};

exports.folder = {};

exports.folder.get = function(req, res) {
  redis.smembers('folder:' + req.params.user + '/' + req.params.folder, function(e, feedkeys) {
    var feedurls = feedkeys.map(function(feedkey) {
      return feedkey.substr(5);
    });

    var unionkeys = feedurls.map(function(feedkey) {
      return 'articles:' + feedkey;
    });
    
    var feeds = [];
    
    if (e) {
      res.status(500).json({
        'success': false,
        'error': {
          'type': 'Redis Error',
          'message': "Couldn't get feeds from folder:" + req.params.user + "/" + req.params.folder
        }
      });
    } else {
      redis.zunionstore([
        'articles:' + req.params.user + '/' + req.params.folder,
        unionkeys.length
      ].concat(unionkeys), function(e) {
        if (e) {
          res.status(500).json({
            'success': false,
            'error': {
              'type': 'Redis Error',
              'message': "Couldn't create article list for " + req.params.user + "/" + req.params.folder
            }
          });
        } else {
          redis.zrevrange('articles:' + req.params.user + '/' + req.params.folder, 0, -1, function(e, articlekeys) {
            if (e) {
              res.status(500).json({
                'success': false,
                'error': {
                  'type': 'Redis Error',
                  'message': "Couldn't get article list for " + req.params.user + "/" + req.params.folder
                }
              });
            } else {
              redis.del('articles:' + req.params.user + '/' + req.params.folder, function(e) {
                if (e) {
                  res.status(500).json({
                    'success': false,
                    'error': {
                      'type': 'Redis Error',
                      'message': "Couldn't delete article list for " + req.params.user
                    }
                  });
                } else {
                  feedurls.forEach(function(feedurl, feedurlPosition) {
                    redis.hgetall('feed:' + feedurl, function(e, feed) {
                      if (e || !feed) feed = {};
                      feed.key = feedurl;
                      feeds.push(feed);
                      if (feedurlPosition === feedurls.length - 1) {
                        var articles = articlekeys.map(function(key) {
                          return key.substr(8);
                        });
                        res.json({
                          'success': true,
                          'feeds': feeds,
                          'articles': articles
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
};

exports.folder.post = function(req, res) {
  if (!req.body.xmlurl) {
    res.status(400).json({
      'success': false,
      'error': {
        'type': 'Missing Parameter Error',
        'message': "xmlurl is required"
      }
    });
  } else {
    redis.hsetnx('feed:' + req.body.xmlurl, 'key', req.body.xmlurl, function(e) {
      if (e) {
        res.status(500).json({
          'success': false,
          'error': {
            'type': 'Redis Error',
            'message': "Couldn't save key for feed:" + req.body.xmlurl
          }
        });
      } else {
        redis.sadd('folder:' + req.user + '/' + req.params.folder, 'feed:' + req.body.xmlurl, function(e) {
          if (e) {
            res.status(500).json({
              'success': false,
              'error': {
                'type': 'Redis Error',
                'message': "Couldn't add " + req.body.xmlurl + " to folder:" + req.user + "/" + req.params.folder
              }
            });
          } else {
            redis.sadd('folders:' + req.user, 'folder:' + req.user + '/' + req.params.folder, function(e){
              if (e) {
                res.status(500).json({
                  'success': false,
                  'error': {
                    'type': 'Redis Error',
                    'message': "Couldn't add folder:" + req.user + "/" + req.params.folder + " to folders:" + req.user
                  }
                });
              } else {
                res.json({'success':true});
              }
            });
          }
        });
      }
    });
  }
};

exports.folder.delete = function(req, res) {
  redis.srem('folder:' + req.user + '/' + req.params.folder, 'feed:' + req.body.xmlurl, function(e) {
    if (e) {
      res.status(500).json({
        'success': false,
        'error': {
          'type': 'Redis Error',
          'message': "Couldn't remove " + req.body.xmlurl + " from folder:" + req.user + "/" + req.params.folder
        }
      });
    } else {
      redis.scard('folder:' + req.user + '/' + req.params.folder, function(e, size) {
        if (e) {
          res.status(500).json({
            'success': false,
            'error': {
              'type': 'Redis Error',
              'message': "Couldn't check if folder:" + req.user + "/" + req.params.folder + " is empty"
            }
          });
        } else if (size===0) {
          redis.srem('folders:' + req.user, 'folder:' + req.user + '/' + req.params.folder, function(e) {
            if (e) {
              res.status(500).json({
                'success': false,
                'error': {
                  'type': 'Redis Error',
                  'message': "Couldn't remove folder:" + req.user + "/" + req.params.folder + " from folders:" + req.user
                }
              });
            } else {
              redis.del('folder:' + req.user + '/' + req.params.folder, function(e) {
                if (e) {
                  res.status(500).json({
                    'success': false,
                    'error': {
                      'type': 'Redis Error',
                      'message': "Couldn't delete folder:" + req.user + "/" + req.params.folder
                    }
                  });
                } else {
                  res.json({'success': true});
                }
              });
            }
          });
        } else {
          res.json({'success': true});
        }
      });
    }
  });
};
