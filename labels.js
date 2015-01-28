var redis = require('redis').createClient()
exports.get = function(req,res){
  redis.smembers('labels:'+req.params.user,function(e,labels){
    if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get labels for "+req.params.user}})
    else res.json({'success':true,'labels':labels.map(function(key){return key.substr(7+req.params.user.length)})})
  })
}
exports.label = {}
exports.label.post = function(req,res){
  redis.sadd('labels:'+req.user,'label:'+req.user+'/'+req.params.label,function(e){
    if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't add label:"+req.user+"/"+req.params.label+" to labels:"+req.user}})
    else if (!req.body||!req.body.hash) res.status(500).json({'success':false,'error':{'type':'Missing Parameter','message':"Article hash required"}})
    else { 
      if (!req.body.score) req.body.score = Date.now()
      redis.zadd('label:'+req.user+'/'+req.params.label, req.body.score,'article:'+req.body.hash,function(e){
        if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't add article:"+req.body.hash+" to label:"+req.user+"/"+req.params.label}})
        else {
          if (req.params.label==='read') redis.zrem('label:'+req.user+'/unread','article:'+req.body.hash,function(e){
            if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't remove article:"+req.body.hash+" from label:"+req.user+"/unread"}})
            else res.json({'success':true})
          })
          else res.json({'success':true})
        }
      })
    }
  })
}
exports.label.get = function(req,res){
  if (req.params.label === 'unread') redis.zrange('label:'+req.params.user+'/'+req.params.label,0,-1,function(e,articles){
    if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get articles labelled "+req.params.label}})
    else res.json({'success':true,'articles':articles.map(function(key){return key.substr(8)})})
  })
  else redis.zrevrange('label:'+req.params.user+'/'+req.params.label,0,-1,function(e,articles){
    if (e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get articles labelled "+req.params.label}})
    else res.json({'success':true,'articles':articles.map(function(key){return key.substr(8)})})
  })
}
