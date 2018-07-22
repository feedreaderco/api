# Feedreader API
This is an API to subscribe to RSS/Atom feeds. Feeds can be organized into folders, and labels can be applied to articles. The folders and labels are stored in Redis. Articles are stored on S3.

## Installation
### AWS Config
Create a file with your AWS credentials, to store articles on S3. The file will need to be in the format `{ "accessKeyId": "id", "secretAccessKey": "secret" }`

### Redis
1. If necessary, install dev tools (for example, with `sudo yum install "development tools"`)
2. `wget http://download.redis.io/redis-stable.tar.gz`
3. `tar xvzf redis-stable.tar.gz`
4. `cd redis-stable`
5. `make && redis-server`

### API
1. `npm install -g feedreader-api`
2. `feedreader-api --aws-config aws-config.json`

## api.feedreader.co
The API is running at api.feedreader.co
