import redis from 'redis';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

function add(user, label, hash, initScore, callback) {
  const labelsKey = `labels:${user}`;
  const labelKey = `label:${user}/${label}`;
  const articleKey = `article:${hash}`;
  const score = initScore || Date.now();
  redisClient.sadd(labelsKey, labelKey, (e) => {
    if (e) {
      callback({
        type: 'Redis Error',
        message: `Couldn't add ${labelKey} to ${labelsKey}`,
      });
    } else {
      redisClient.zadd(labelKey, score, articleKey, (zaddErr) => {
        if (zaddErr) {
          callback({
            type: 'Redis Error',
            message: `Couldn't add ${articleKey} to ${labelKey}`,
          });
        } else if (label === 'read') {
          const unreadLabel = `label:${user}/unread`;
          redisClient.zrem(unreadLabel, articleKey, (zremErr) => {
            if (zremErr) {
              callback({
                type: 'Redis Error',
                message: `Couldn't remove ${articleKey} from ${unreadLabel}`,
              });
            } else {
              callback();
            }
          });
        } else {
          callback();
        }
      });
    }
  });
}

function remove(user, label, hash, callback) {
  const labelKey = `label:${user}/${label}`;
  const articleKey = `article:${hash}`;
  redisClient.zrem(labelKey, articleKey, (zremErr) => {
    if (zremErr) {
      callback({
        type: 'Redis Error',
        message: `Couldn't remove ${articleKey} from ${unreadLabel}`,
      });
    } else {
      callback();
    }
  });
}

function get(req, res) {
  redisClient.smembers(`labels:${req.params.user}`, (e, labels) => {
    if (e) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: `Couldn't get labels for ${req.params.user}`,
        },
      });
    } else {
      res.json({
        success: true,
        labels: labels.map(key => key.substr(7 + req.params.user.length)),
      });
    }
  });
}

const label = {
  post: (req, res) => {
    if (!req.body || !req.body.hash) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Missing Parameter',
          message: 'Article hash required',
        },
      });
    }
    add(req.user, req.params.label, req.body.hash, req.body.score, (e) => {
      if (e) {
        res.status(500).json({
          success: false,
          error: e,
        });
      } else {
        res.json({ success: true });
      }
    });
  },

  del: (req, res) => {
    if (!req.body || !req.body.hash) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Missing Parameter',
          message: 'Article hash required',
        },
      });
    }
    remove(req.user, req.params.label, req.body.hash, (e) => {
      if (e) {
        res.status(500).json({
          success: false,
          error: e,
        });
      } else {
        res.json({ success: true });
      }
    });
  },

  get: (req, res) => {
    if (req.params.label === 'unread') {
      redisClient.zrange(`label:${req.params.user}/${req.params.label}`, 0, -1, (e, articles) => {
        if (e) {
          res.status(500).json({
            success: false,
            error: {
              type: 'Redis Error',
              message: `Couldn't get articles labelled ${req.params.label}`,
            },
          });
        } else {
          res.json({
            success: true,
            articles: articles.map(key => key.substr(8)),
          });
        }
      });
    } else {
      redisClient.zrevrange(`label:${req.params.user}/${req.params.label}`, 0, -1, (e, articles) => {
        if (e) {
          res.status(500).json({
            success: false,
            error: {
              type: 'Redis Error',
              message: `Couldn't get articles labelled ${req.params.label}`,
            },
          });
        } else {
          res.json({
            success: true,
            articles: articles.map(key => key.substr(8)),
          });
        }
      });
    }
  },
};

export default { get, label, add };
