var redis = require('redis').createClient()
, crypto = require('crypto')
, http = require('http')
, awssum = require('awssum')
, amazon = awssum.load('amazon/amazon')
, amazonSettings = {'accessKeyId':'AKIAJGMWU75U3YTLXW7Q','secretAccessKey':'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','region':amazon.US_EAST_1}
, S3 = awssum.load('amazon/s3').S3
, s3 = new S3(amazonSettings)
exports.hash = function(article){
  return crypto.createHash('md5').update(article.description).digest('hex')
}
exports.post = function(req,res){
  res.json({'success':true,'hash':exports.hash(req.body)})
}
exports.get = function(req,res){
  s3.GetObject({BucketName:'articles.feedreader.co',ObjectName:req.params.hash},function(e,d){
    if (e) res.json({'success':false,'error':{'type':'S3 Error','message':"Couldn't get http://articles.feedreader.co/"+req.params.hash,'log':e}},500)
    else {
      var data = new Buffer(d.Body)
      , article = JSON.parse(data.toString())
      res.json({'success':true,'article':article})
    }
  })
}
