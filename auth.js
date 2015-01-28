var redis = require('redis').createClient()
module.exports = function(req,res,next){
  var header = req.headers['authorization']||''
  , split_header = header.split(/\s+/)
  , encoded = split_header.pop()||''
  , decoded = new Buffer(encoded,'base64').toString()
  , auth = decoded.split(':')[0]
  if (!auth) auth=req.query['token']
  redis.get('auth:'+auth,function(e,u){
    if(e) res.status(500).json({'success':false,'error':{'type':'Redis Error','message':"Couldn't get user for token "+auth}})
    if(!u) res.status(401).json({'success':false,'error':{'type':'Invalid Credentials Error','message':"Token ('"+auth+"') doesn't match anything we've got stored"}})
    else {
      req.user = u
      if (req.user === req.params.user) next()
      else res.status(401).json({'success':false,'error':{'type':'Invalid Credentials Error','message':"Token ('"+auth+"') hasn't been stored for "+req.params.user}})
    }
  })
}
