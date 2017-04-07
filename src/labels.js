import redis from 'redis';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

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
    redisClient.sadd(`labels:${req.user}`, `label:${req.user}/${req.params.label}`, (e) => {
      if (e) {
        res.status(500).json({
          success: false,
          error: {
            type: 'Redis Error',
            message: `Couldn't add label:${req.user}/${req.params.label} to labels:${req.user}`,
          },
        });
      } else if (!req.body || !req.body.hash) {
        res.status(500).json({
          success: false,
          error: {
            type: 'Missing Parameter',
            message: 'Article hash required',
          },
        });
      } else {
        const key = `label:${req.user}/${req.params.label}`;
        const score = req.body.score || Date.now();
        redisClient.zadd(key, score, `article:${req.body.hash}`, (zaddErr) => {
          if (zaddErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Redis Error',
                message: `Couldn't add article:${req.body.hash} to label:${req.user}/${req.params.label}`,
              },
            });
          } else if (req.params.label === 'read') {
            redisClient.zrem(`label:${req.user}/unread`, `article:${req.body.hash}`, (zremErr) => {
              if (zremErr) {
                res.status(500).json({
                  success: false,
                  error: {
                    type: 'Redis Error',
                    message: `Couldn't remove article:${req.body.hash} from label:${req.user}/unread`,
                  },
                });
              } else {
                res.json({ success: true });
              }
            });
          } else {
            res.json({ success: true });
          }
        });
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

export default { get, label };
