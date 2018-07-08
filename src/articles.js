import crypto from 'crypto';
import AWS from 'aws-sdk';
import labels from './labels';

export function hash(article) {
  return crypto.createHash('md5').update(article.guid).digest('hex');
}

export function score(article) {
  const articleDate = article.pubDate || article.pubdate || article.date;
  const articleScore = Date.parse(articleDate) || Date.now();
  return articleScore;
}

function post(req, res) {
  res.json({
    success: true,
    hash: exports.hash(req.body),
  });
}

function get(req, res) {
  const params = { Bucket: 'feedreader2018-articles' };
  const s3 = new AWS.S3({ params });

  s3.getObject({ Key: req.params.hash }, (e, d) => {
    if (e) {
      if (e.code === "NoSuchKey") {
        labels.add('all', 'missing', req.params.hash, Date.now(), (e) => {
          if (e) {
            res.status(500).json({
              success: false,
              error: e,
            });
          } else {
            res.status(404).json({
              success: false,
              error: {
                type: 'Not Found',
                message: `Couldn't find ${req.params.hash}`,
              },
            });
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            type: 'S3 Error',
            message: `Couldn't get ${req.params.hash}`,
            log: e,
          },
        });
      }
    } else {
      const data = new Buffer(d.Body);
      const article = JSON.parse(data.toString());
      res.json({
        success: true,
        article,
      });
    }
  });
}

export default { post, get };
