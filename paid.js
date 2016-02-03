require('dotenv').config();
var redis = require('redis').createClient({host: process.env.REDIS_HOST});

exports.post = function(q, r) {
  redis.get('token:' + q.params.token, function(e, u) {
    redis.hmset('user:' + u, 'paid', q.body.price, 'email', q.body.email, function(e, v) {
      if (e) {
        r.status(500).json({
          'success': false,
          'error': {
            'type': 'Redis Error',
            'message': "Couldn't set price and email for " + u
          }
        });
      } else {
        redis.del('token:' + q.params.token, function(e) {
          if (e) {
            r.status(500).json({
              'success': false,
              'error': {
                'type': 'Redis Error',
                'message': "Couldn't delete token " + q.params.token
              }
            });
          } else {
            r.send('https://feedreader.co');
          }
        });
      }
    });
  });
};
