import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import redis from 'redis';
import Promise from 'bluebird';

Promise.promisifyAll(redis);
Promise.promisifyAll(bcrypt);
Promise.promisifyAll(crypto);

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

function post(req, res) {
  bcrypt.genSaltAsync(10)
  .then(salt => bcrypt.hashAsync(req.body.password, salt))
  .then(hash => redisClient.hsetnxAsync(`user:${req.body.user}`, 'password', hash))
  .then(() => crypto.randomBytesAsync(48))
  .then((buffer) => {
    const token = buffer.toString('hex');
    redisClient.setAsync(`auth:${token}`, req.body.user).then(() => {
      const auth = new Buffer(`${token}:`).toString('base64');
      res.header('Authorization', auth);
      res.json({
        success: true,
        token,
      });
    }).catch(() => {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: `Couldn't set auth token for ${req.params.user}`,
        },
      });
    });
  })
  .catch(() => {
    res.status(500).json({
      success: false,
      error: {
        type: 'RandomBytes Error',
        message: 'Couldn\'t generate auth token',
      },
    });
  });
}

export default { post };
