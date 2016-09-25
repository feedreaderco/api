#Feedreader API
This is an API to subscribe to RSS/Atom feeds. Feeds can be organized into folders, and labels can be applied to articles. The folders and labels are stored in Redis. Articles are stored on S3.

##Installation
1. Clone the repository
2. Inside the repository, create a file named `aws-config.json` with your AWS credentials (used to store articles on S3) in the format `{ "accessKeyId": "id", "secretAccessKey": "secret" }`
3. Set `$REDIS_HOST` and `$GUMROAD_TOKEN`
4. `npm install && npm start`

##api.feedreader.co
The API is running at api.feedreader.co
