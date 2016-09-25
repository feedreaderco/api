var crypto = require('crypto');
var bcrypt = require('bcrypt');
var https = require('https');
var querystring = require('querystring');

var redis = require('redis').createClient();

exports.post = function(req, res) {
  console.log(req.body.user);
  bcrypt.genSalt(10, function(e, salt) {
    bcrypt.hash(req.body.password, salt, function(e, hash) {
      redis.hsetnx('user:' + req.body.user, 'password', hash, function(e) {
        crypto.randomBytes(48, function(e,b) {
          if (e) {
            res.status(500).json({
              'success': false,
              'error': {
		'type': 'RandomBytes Error',
                'message': "Couldn't generate auth token"
              }
            });
          } else {
            var t = b.toString('hex');
            redis.set('auth:' + t, req.params.user, function(e, r) {
              if (e) {
                res.status(500).json({
                  'success': false,
                  'error': {
                    'type': 'Redis Error',
                    'message': "Couldn't set auth token for " + req.params.user
                   }
                });
              } else {
                res.header('Authorization', new Buffer(t + ':').toString('base64'));
                res.json({
                  'success': true,
                  'token': t
                });
              }
	    });
          }
        });
      });
    });
  });
};
