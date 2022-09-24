import redis from 'redis';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

function post(req, res) {
  if (!req.body.password) {
    res.status(401).json({
      success: false,
      error: {
        type: 'Invalid Credentials Error',
        message: 'Password is required',
      },
    });
  } else {
    redisClient.hget(`user:${req.params.user}`, 'password', (e, hash) => {
      if (e) {
        res.status(500).json({
          success: false,
          error: {
            type: 'Redis Error',
            message: `Couldn't get hash for ${req.params.user}`,
          },
        });
      } else if (!hash) {
        res.status(401).json({
          success: false,
          error: {
            type: 'Missing Credentials Error',
            message: `Couldn't get hash for ${req.params.user}`,
          },
        });
      } else {
        bcrypt.compare(req.body.password, hash, (bcryptErr, s) => {
          if (bcryptErr) {
            res.status(500).json({
              success: false,
              error: {
                type: 'Bcrypt Error',
                message: `Couldn't compare hash for ${req.params.user}`,
              },
            });
          } else if (!s) {
            res.status(401).json({
              success: false,
              error: {
                type: 'Invalid Credentials Error',
                message: 'Credentials don\'t match the hash we\'ve got stored',
              },
            });
          } else {
            crypto.randomBytes(24, (randomBytesErr, bytes) => {
              const token = bytes.toString('hex');
              if (randomBytesErr) {
                res.status(500).json({
                  success: false,
                  error: {
                    type: 'RandomBytes Error',
                    message: 'Couldn\'t generate auth token',
                  },
                });
              } else {
                redisClient.set(`auth:${token}`, req.params.user, (setTokenErr) => {
                  if (setTokenErr) {
                    res.status(500).json({
                      success: false,
                      error: {
                        type: 'Redis Error',
                        message: `Couldn't set auth token for ${req.params.user}`,
                      },
                    });
                  } else {
                    res.header('Authorization', new Buffer(`${token}:`).toString('base64'));
                    res.json({
                      success: true,
                      token,
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
}

function del(q, r) {
  redisClient.del(`auth:${q.auth}`, (e) => {
    if (e) r.send(500);
    else r.json({ success: true });
  });
}

export default { post, del };
