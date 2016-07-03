var redis = require('redis').createClient();
var crypto = require('crypto');
var bcrypt = require('bcrypt');

exports.post = function(req, res) {
  if (!req.body.password) {
    res.status(401).json({
      'success': false,
      'error': {
        'type': 'Invalid Credentials Error',
        'message': "Password is required"
      }
    });
  } else {
    redis.hget('user:' + req.params.user, 'password', function(e, hash) {
      if (e) {
        res.status(500).json({
          'success': false,
          'error': {
            'type': 'Redis Error',
            'message': "Couldn't get hash for " + req.params.user
          }
        });
      } else if (!hash) {
        res.status(401).json({
          'success': false,
          'error': {
            'type': 'Missing Credentials Error',
            'message': "Couldn't get hash for " + req.params.user
          }
        });
      } else {
        bcrypt.compare(req.body.password, hash, function(e, s) {
          if (e) {
            res.status(500).json({
              'success': false,
              'error': {
                'type': 'Bcrypt Error',
                'message': "Couldn't compare hash for " + req.params.user
              }
            });
          } else if (!s) {
            res.status(401).json({
              'success': false,
              'error': {
                'type': 'Invalid Credentials Error',
                'message': "Credentials don't match the hash we've got stored"
              }
            });
          } else {
            crypto.randomBytes(24, function(e, b) {
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
          }
        });
      }
    });
  }
};

exports.delete = function(q, r) {
  redis.del('auth:' + q.auth, function(e) {
    if (e) r.send(500);
    else r.json({'success': true});
  });
};
