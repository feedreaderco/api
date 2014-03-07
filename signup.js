var crypto = require('crypto')
, bcrypt = require('bcrypt')
, https = require('https')
, querystring = require('querystring')
, redis = require('redis').createClient()
, gumroadConfig = require('fs').readFileSync('gumroad-config.json')
, gumroadToken = JSON.parse(gumroadConfig).token
exports.post = function(req,res){
  console.log(req.body.user)
  bcrypt.genSalt(10,function(e,salt){
    bcrypt.hash(req.body.password,salt,function(e,hash){
      redis.hsetnx('user:'+req.body.user,'password',hash,function(e){
        crypto.randomBytes(48,function(e,b){
          var token = b.toString('hex')
          redis.set('token:'+token,req.body.user,function(e,u){
	    var postdata = querystring.stringify({'name':'Feed Reader Subscription for '+req.body.user
            , 'url':'https://feedreader.co/paid/'+token
            , 'price':100
            , 'description':'Access to the Feed Reader API'
            , 'webhook':true
            , 'auth_token':gumroadToken
            })
            var gumroad = https.request({host:"api.gumroad.com"
            , path:"/v2/products"
            , headers:{
	      'Content-Type':'application/x-www-form-urlencoded',
              'Content-Length':postdata.length
            }
            , method:"POST"}
            , function(s){
              s.on('data',function(chunk){
                try {
                  if((product=JSON.parse(chunk).product)) res.redirect(product.short_url)
                  else process.stdout.write(chunk)
                }
                catch(e) {
                 process.stdout.write(chunk)
                 res.redirect('/error.html')
                }
              })
            })
            gumroad.write(postdata)
            gumroad.on('error',function(e){
              res.json({'success':false,'error':{'type':'Gumroad Error','message':"Couldn't create payment url for "+req.body.user}},500)
            })
            gumroad.end()
          })
        })
      })
    })
  })
}
