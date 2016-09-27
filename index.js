#!/usr/bin/env node
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

var auth = require('./lib/auth');
var sessions = require('./lib/sessions');
var signup = require('./lib/signup');
var feeds = require('./lib/feeds.js');
var folders = require('./lib/folders.js');
var articles = require('./lib/articles.js');
var labels = require('./lib/labels.js');

var app = express();

let awsConfigPath = 'aws-config.json';
if (process.argv.length === 4) {
  awsConfigPath = process.argv[3];
}

app.use(cors());
app.use(express.static(__dirname+'/static'));
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
app.get('/v1/feeds/*', feeds.feed.get(awsConfigPath));

app.post('/v1/articles', articles.post);
app.get('/v1/articles/:hash', articles.get(awsConfigPath));

app.post('/v1/signup', signup.post);

app.listen(8000);
