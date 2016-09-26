'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.post = post;

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _bcrypt = require('bcrypt');

var _bcrypt2 = _interopRequireDefault(_bcrypt);

var _redis = require('redis');

var _redis2 = _interopRequireDefault(_redis);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_bluebird2.default.promisifyAll(_redis2.default);
_bluebird2.default.promisifyAll(_bcrypt2.default);
_bluebird2.default.promisifyAll(_crypto2.default);

var redisClient = _redis2.default.createClient();

function post(req, res) {
  _bcrypt2.default.genSaltAsync(10).then(function (salt) {
    return _bcrypt2.default.hashAsync(req.body.password, salt);
  }).then(function (hash) {
    return redisClient.hsetnxAsync('user:' + req.body.user, 'password', hash);
  }).then(function () {
    return _crypto2.default.randomBytesAsync(48);
  }).then(function (buffer) {
    var token = buffer.toString('hex');
    redisClient.setAsync('auth:' + token, req.body.user).then(function () {
      var auth = new Buffer(token + ':').toString('base64');
      res.header('Authorization', auth);
      res.json({
        success: true,
        token: token
      });
    }).catch(function () {
      res.status(500).json({
        success: false,
        error: {
          type: 'Redis Error',
          message: 'Couldn\'t set auth token for ' + req.params.user
        }
      });
    });
  }).catch(function () {
    res.status(500).json({
      success: false,
      error: {
        type: 'RandomBytes Error',
        message: 'Couldn\'t generate auth token'
      }
    });
  });
}