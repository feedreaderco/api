var redis = require('redis').createClient()
, Feedparser = require('feedparser')
, parser = new Feedparser()
, http = require('http')
, url = require('url')
, crypto = require('crypto')
, awssum = require('awssum')
, amazon = awssum.load('amazon/amazon')
, amazonSettings = {'accessKeyId':'AKIAJGMWU75U3YTLXW7Q','secretAccessKey':'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','region':amazon.US_EAST_1}
, S3 = awssum.load('amazon/s3').S3
, s3 = new S3(amazonSettings)
exports.post = function(req,res){
  if (!req.body.id) res.json({'success':false,'error':{'type':'Missing Parameter','message':"id is required"}},500)
  else redis.lpush('unread:'+req.user,'article:'+req.body.id,function(e){
    if (e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't add article:"+req.body.id+" to unread:"+req.user}},500)
    else res.json({'success':true})
  })
}
exports.get = function(req,res){
  redis.smembers('folders:'+req.user,function(e,folders){
    if (e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get folders for "+req.user}},500)
    else redis.sunion(folders,function(e,feedkeys){
      var feeds = {}
      if (e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get feeds from all folders for "+req.user}},500)
      else feedkeys.forEach(function(key,feedpos){
        redis.hgetall(key,function(e,feed){
          if (e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get details for "+key}},500)
          else {
            var options = url.parse(key.substr(5))
            options['headers'] = {'If-Modified-Since':feed.lastModified,'If-None-Match':feed.etag}
            var request = http.request(options)
            request.on('error',function(e){
              console.log('user:'+req.user+' feed:'+key.substr(5)+' problem with request: ' + e.message);
            })
            request.on('response',function(response){
              if (response.statusCode==200) parser.parseStream(response,function(e,meta,articles){
                if (!e) redis.hmset(key,'lastModified',response.headers['Last-Modified'],'etag',response.headers['Etag'],function(e){
                  if (!e) articles.forEach(function(article,articlepos){
                    article.hash = crypto.createHash('md5').update(article.pubdate + article.link + article.meta.xmlurl).digest('hex')
                    var body = JSON.stringify(article)
                    s3.PutObject({BucketName:'articles.shelf.name'
                      , ObjectName:article.hash
                      , ContentLength:Buffer.byteLength(body)
                      , Body:body
                    }
                    , function (e,d) {
                      if (!e) redis.zscore('read:'+req.user,'article:'+article.hash,function(e,timestamp){
                        if (!timestamp) redis.rpush('unread:'+req.user,'article:'+article.hash, function(e){
                          if ((feedpos === feedkeys.length -1)&&(articlepos === articles.length - 1)) {
                            var ret = []
                            redis.lrange('unread:'+req.user,0,-1,function(e,articles){
                              if (!e) articles.forEach(function(article,position){
                                ret.push(article.substr(8))
                                if (position === articles.length - 1) res.json({'success':true,'unread':ret})
                              })
                            })
                          }
                        })
                      })
                    })
                  })
                })
              })
            })
            request.end()
          }
        })
      })
    })
  })
}
