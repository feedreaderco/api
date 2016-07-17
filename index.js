var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

var auth = require('./auth');
var sessions = require('./sessions');
var signup = require('./signup');
var feeds = require('./feeds.js');
var folders = require('./folders.js');
var articles = require('./articles.js');
var labels = require('./labels.js');

var app = express();

app.use(cors());
app.use(express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/v1/:user/tokens', sessions.post);
app.delete('/v1/:user/tokens', auth, sessions.delete);

app.get('/v1/:user/folders', folders.get);
app.get('/v1/:user/folders/:folder', folders.folder.get);
app.post('/v1/:user/folders/:folder', auth, folders.folder.post);
app.delete('/v1/:user/folders/:folder', auth, folders.folder.delete);

app.get('/v1/:user/labels', labels.get);
app.get('/v1/:user/labels/:label', labels.label.get);
app.post('/v1/:user/labels/:label', auth, labels.label.post);

app.get('/v1/:user/feeds', feeds.get);
app.get('/v1/feeds/*', feeds.feed.get);

app.post('/v1/articles', articles.post);
app.get('/v1/articles/:hash', articles.get);

app.post('/v1/signup', signup.post);

app.listen(8000);
