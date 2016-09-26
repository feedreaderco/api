var crypto = require('crypto');
var AWS = require('aws-sdk');

exports.hash = function(article) {
  return crypto.createHash('md5').update(article.guid).digest('hex');
};

exports.score = function(article) {
  var article_date = article.pubDate || article.pubdate || article.date;
  var score = Date.parse(article_date) || Date.now();
  return(score);
};

exports.post = function(req,res) {
  res.json({
    'success': true,
    'hash': exports.hash(req.body)
  });
};

export function get(configPath) {
  AWS.config.loadFromPath('./aws-config.json');

  var s3 = new AWS.S3({
    params: {
      Bucket: 'feedreader2016-articles'
    }
  });

return function(req,res) {

  s3.getObject({
    Key: req.params.hash
  }, function(e,d) {
    if (e) {
      res.status(500).json({
        'success': false,
        'error': {
          'type': 'S3 Error',
          'message': "Couldn't get " + req.params.hash,
          'log': e
        }
      });
    } else {
      var data = new Buffer(d.Body);
      var article = JSON.parse(data.toString());
      res.json({
        'success': true,
        'article': article
      });
    }
  });
};
}
