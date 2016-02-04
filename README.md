#Feedreader
This is what happens at feedreader.co and api.feedreader.co

##Feedreader.co
To deploy the website to heroku, use this button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

##Feedreader API
The API uses Redis for labels and folders, S3 for articles and feeds, and Gumroad for signup. Create an `aws-config.json` file with your AWS credentials, and set `$REDIS_HOST` and `$GUMROAD_TOKEN`
