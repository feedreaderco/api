var redis = require('redis').createClient()
, crypto = require('crypto')
, http = require('http')
, AWS = require('aws-sdk')
AWS.config.loadFromPath('./aws-config.json')
var s3 = new AWS.S3({params:{Bucket:'articles.feedreader.co'}})
exports.hash = function(article){
  return crypto.createHash('md5').update(article.guid).digest('hex')
}
exports.post = function(req,res){
  res.json({'success':true,'hash':exports.hash(req.body)})
}
exports.get = function(req,res){
  s3.getObject({Key:req.params.hash},function(e,d){
    if (e) res.json({'success':false,'error':{'type':'S3 Error','message':"Couldn't get http://articles.feedreader.co/"+req.params.hash,'log':e}},500)
    else {
      var data = new Buffer(d.Body)
      , article = JSON.parse(data.toString())
      res.json({'success':true,'article':article})
    }
  })
}
