var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');

var auth = require('./auth');
var sessions = require('./sessions');
var signup = require('./signup');
var paid = require('./paid');
var feeds = require('./feeds.js');
var folders = require('./folders.js');
var articles = require('./articles.js');
var labels = require('./labels.js');

var options = {
  key: fs.readFileSync('certificates2015/certificate-private.key'),
  cert: fs.readFileSync('certificates2015/web-server-certificate.crt'),
  ca: [
    fs.readFileSync('certificates2015/primary-intermediate-certificate.crt')
  ]
};

var app = express();

app.use(express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.all('*', function(req,res,next) {
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  if ('OPTIONS' == req.method) return res.sendStatus(200)
  next()
});

app.post('/api/v1/:user/tokens', sessions.post);
app.delete('/api/v1/:user/tokens', auth,sessions.delete);

app.get('/api/v1/:user/folders', folders.get);
app.get('/api/v1/:user/folders/:folder', folders.folder.get);
app.post('/api/v1/:user/folders/:folder', auth, folders.folder.post);
app.delete('/api/v1/:user/folders/:folder', auth, folders.folder.delete);

app.get('/api/v1/:user/labels', labels.get);
app.get('/api/v1/:user/labels/:label', labels.label.get);
app.post('/api/v1/:user/labels/:label', auth, labels.label.post);

app.get('/api/v1/:user/feeds', feeds.get);
app.get('/api/v1/feeds/*', feeds.feed.get);

app.post('/api/v1/articles', articles.post);
app.get('/api/v1/articles/:hash', articles.get);

app.post('/signup', signup.post);
app.post('/paid/:token', paid.post);

app.get('/:user/labels/:label*', function(req,res) {
  res.sendFile(path.join(__dirname, 'label.html'));
});

app.get('/:user/folders/:folder*', function(req,res) {
  res.sendFile(path.join(__dirname, 'label.html'));
});

app.get('/:user/feeds*', function(req,res) {
  res.sendFile(path.join(__dirname, 'label.html'));
});

app.get('/feeds/*', function(req,res) {
  res.sendFile(path.join(__dirname, 'label.html'));
});

app.get('/:user', function(req,res) {
  res.sendFile(path.join(__dirname, 'user.html'));
});

https.createServer(options, app).listen(8000);

http.createServer(express().use(function(req,res) {
  res.redirect(301, 'https://feedreader.co' + req.url);
})).listen(8080);
