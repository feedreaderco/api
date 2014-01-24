var redis = require('redis').createClient()
exports.post = function(q,r){
  redis.get('token:'+q.params.token,function(e,u){
    redis.hmset('user:'+u,'paid',q.body.price,'email',q.body.email,function(e,v){
      if(e) r.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't set price and email for "+u}},500)
      else redis.del('token:'+q.params.token,function(e){
        if(e) r.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't delete token "+q.params.token}},500)
        else r.send('https://feedreader.co')
      })
    })
  })
}
