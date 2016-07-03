var redis = require('redis').createClient();

exports.post = function(q, r) {
  // From https://gumroad.com/webhooks
  // The buyer makes a purchase, and we send a request to your endpoint.
  // You do some custom logic (for example, generate a unique license key with a specific URL) and send us back a response URL.
  // We return the response URL to the buyer.
  redis.hgetall('token:' + q.params.token, function(e, signupDetails) {
    redis.hmset('user:' + signupDetails.username, 'paid', q.body.price, 'email', q.body.email, function(e, v) {
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
            r.send(signupDetails.redirectURL);
          }
        });
      }
    });
  });
};
