require('dotenv').config();
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var https = require('https');
var querystring = require('querystring');

var redis = require('redis').createClient();
var gumroadToken = process.env.GUMROAD_TOKEN;

exports.post = function(req, res) {
  console.log(req.body.username);
  bcrypt.genSalt(10, function(e, salt) {
    bcrypt.hash(req.body.password, salt, function(e, hash) {
      redis.hsetnx('user:' + req.body.username, 'password', hash, function(e) {
        crypto.randomBytes(48, function(e,b) {
          var token = b.toString('hex');
          redis.hmset('token:' + token, 'username', req.body.username, 'redirectURL', req.body.redirecturl, function(e,u) {
	          var postdata = querystring.stringify({
              'name': 'Feed Reader Subscription for '+req.body.username,
              'url': 'https://feedreader.co/paid/'+token,
              'price': 100,
              'description': 'Access to the Feed Reader API',
              'webhook': true,
              'access_token': gumroadToken
            });

            var gumroad = https.request({
              hostname: "api.gumroad.com",
              path: "/v2/products",
              headers: {
	              'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postdata.length
              },
              method: "POST"
            }, function(s) {
              var body = '';
              s.setEncoding('utf8');
              s.on('data', function(chunk) {
                body += chunk;
              });
              s.on('end', function() {
                try {
                  product = JSON.parse(body).product;
                  res.status(200).json({
                    'success': true,
                    'url': product.short_url
                  });
                } catch(e) {
                  console.log('STATUS: ' + s.statusCode);
                  console.log('HEADERS: ' + JSON.stringify(s.headers));
                  console.log(body);
                  res.status(500).json({
                    'success': false,
                    'error': {
                      'type': 'Gumroad Error',
                      'message': "Couldn't create payment url for " + req.body.username
                    }
                  });
                }
              });
            });

            gumroad.write(postdata);

            gumroad.on('error', function(e) {
              res.status(500).json({
                'success': false,
                'error': {
                  'type': 'Gumroad Error',
                  'message': "Couldn't create payment url for " + req.body.username
                }
              });
            });

            gumroad.end();
          });
        });
      });
    });
  });
};
