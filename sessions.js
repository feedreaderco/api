var crypto = require('crypto')
, bcrypt = require('bcrypt')
, redis = require('redis').createClient()
exports.post = function(req,res){
  if(!req.body.password) res.json({'success':false,'error':{'type':'Invalid Credentials Error','message':"Password is required"}},401)
  else redis.hget('user:'+req.params.user,'password',function(e,hash){
    if(e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get hash for "+req.params.user}},500)
    else if(!hash) res.json({'success':false,'error':{'type':'Missing Credentials Error','message':"Couldn't get hash for "+req.params.user}},401)
    else bcrypt.compare(req.body.password,hash,function(e,s){
      if(e) res.json({'success':false,'error':{'type':'Bcrypt Error','message':"Couldn't compare hash for "+req.params.user}},500)
      else if(!s) res.json({'success':false,'error':{'type':'Invalid Credentials Error','message':"Credentials don't match the hash we've got stored"}},401)
      else crypto.randomBytes(24,function(e,b){
        if(e) res.json({'success':false,'error':{'type':'RandomBytes Error','message':"Couldn't generate auth token"}},500)
        var t = b.toString('hex')
        redis.set('auth:'+t,req.params.user,function(e,r){
          if(e) res.json({'success':false,'error':{'type':'Redis Error','message':"Couldn't set auth token for "+req.params.user}},500)
          else {
            res.header('Authorization',new Buffer(t+':').toString('base64'))
            res.json({'success':true,'token':t})
          }
        })
      })
    })
  })
}
exports.delete = function(q,r){
  redis.del('auth:'+q.auth,function(e){
    if(e) r.send(500)
    else r.json({'success':true})
  })
}
