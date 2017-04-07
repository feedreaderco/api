import crypto from 'crypto';
import AWS from 'aws-sdk';

function hash(article) {
  return crypto.createHash('md5').update(article.guid).digest('hex');
}

function score(article) {
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
  const params = { Bucket: 'feedreader2017-articles' };
  const s3 = new AWS.S3({ params });

  s3.getObject({ Key: req.params.hash }, (e, d) => {
    if (e) {
      res.status(500).json({
        success: false,
        error: {
          type: 'S3 Error',
          message: `Couldn't get ${req.params.hash}`,
          log: e,
        },
      });
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

export default { hash, score, post, get };
