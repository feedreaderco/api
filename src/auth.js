import redis from 'redis';

const redisURL = process.env.REDIS_URL;
const redisClient = redis.createClient(redisURL);

export default function (req, res, next) {
  const header = req.headers.authorization || '';
  const splitHeader = header.split(/\s+/);
  const encoded = splitHeader.pop() || '';
  const decoded = new Buffer(encoded, 'base64').toString();

  let auth = decoded.split(':')[0];
  if (!auth) auth = req.query.token;

  redisClient.get(`auth:${auth}`, (e, u) => {
    if (e) {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: `Couldn't get user for token ${auth}`,
        },
      });
    }

    if (!u) {
      res.status(401).json({
        success: false,
        error: {
          type: 'Invalid Credentials Error',
          message: `Token ('${auth}') doesn't match anything we've got stored`,
        },
      });
    } else {
      req.user = u; // eslint-disable-line no-param-reassign
      if (req.user === req.params.user) {
        next();
      } else {
        res.status(401).json({
          success: false,
          error: {
            type: 'Invalid Credentials Error',
            message: `Token ('${auth}') hasn't been stored for ${req.params.user}`,
          },
        });
      }
    }
  });
}
