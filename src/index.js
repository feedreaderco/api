import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import auth from './auth';
import articles from './articles';
import feeds from './feeds';
import folders from './folders';
import labels from './labels';
import sessions from './sessions';
import signup from './signup';

const app = express();

app.use(cors());
app.use(express.static(`${__dirname}/static`));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/v1/:user/tokens', sessions.post);
app.delete('/v1/:user/tokens', auth, sessions.del);

app.get('/v1/:user/folders', folders.get);
app.get('/v1/:user/folders/:folder', folders.folder.get);
app.post('/v1/:user/folders/:folder', auth, folders.folder.post);
app.delete('/v1/:user/folders/:folder', auth, folders.folder.del);

app.get('/v1/:user/labels', labels.get);
app.get('/v1/:user/labels/:label', labels.label.get);
app.post('/v1/:user/labels/:label', auth, labels.label.post);

app.get('/v1/:user/feeds', feeds.get);
app.get('/v1/feeds/*', feeds.feed.get);

app.post('/v1/articles', articles.post);
app.get('/v1/articles/:hash', articles.get);

app.post('/v1/signup', signup.post);

app.listen(8000);
