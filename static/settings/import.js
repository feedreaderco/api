var googleReaderImport = function (username,password,callback) {
  var tokens = {}
  , api = function(method,endpoint,callback,params) {
    var xhr = new XMLHttpRequest()
    , urlparams = '?token='+localStorage.token
    if (params) if (method==='GET') urlparams = "?"+params
    xhr.open(method,'https://feedreader.co/'+localStorage.user+'/'+endpoint+'/json'+urlparams)
    xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded")
    xhr.onload = callback
    xhr.send(params)
  }
  , getSidToken = function (username,password,callback) {
    var xhr = new XMLHttpRequest()
    xhr.open('POST','https://www.google.com/accounts/ClientLogin')
    xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded')
    xhr.onload = callback
    xhr.send('accountType=GOOGLE&Email='+encodeURIComponent(username)+'&Passwd='+encodeURIComponent(password)+'&service=reader&source=FeedReader')
  }
  , getTToken = function (callback) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET','https://www.google.com/reader/api/0/token')
    xhr.setRequestHeader('Cookie',tokens.sid)
    xhr.onload = callback
    xhr.send()
  }
  , getFeeds = function (callback) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET','https://www.google.com/reader/api/0/subscription/list?output=json&T='+tokens.T)
    xhr.setRequestHeader('Cookie',tokens.sid)
    xhr.onload = callback
    xhr.send()
  }
  , getUnread = function(callback){
    var xhr = new XMLHttpRequest()
    xhr.open('GET','https://www.google.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?output=json&T='+tokens.T)
    xhr.setRequestHeader('Cookie',tokens.sid)
    xhr.onload = callback
    xhr.send()
  }
  , feedreaderSubscribe = function(feed,callback){
    if (!feed.categories) api('POST','feeds',callback,'xmlurl='+feed.id+'&title='+feed.title)
    else api('POST','folders/'+feed.categories.label,callback,'xmlurl='+feed.id)
  }
  , feedreaderGetHash = function(article,callback){
    api('POST','articles',callback,'pubdate='+article.pubdate+'&link='+article.link+'&xmlurl='+article.meta.xmlurl)
  }
  , feedreaderLabelUnread = function(hash,callback){
    api('POST','labels/unread',callback,'hash='+hash)
  }
  getSidToken(username,password,function(){
    alert(this.responseText)
    var i = this.responseText.indexOf('SID=')
    , j = this.responseText.indexOf('/n',i)
    tokens.sid = this.responseText.substring(i,j)
    getTToken(function(){
      tokens.T = this.responseText
      getFeeds(function(){
        var count = 0
        if ((feeds = JSON.parse(this.responseText).feeds)) feeds.forEach(function(feed,pos){
          feedreaderSubscribe(feed,function(){
            ++count
            if (count===feeds.length) getUnread(function(){
              if ((articles = JSON.parse(this.responseText).articles)) articles.forEach(function(article,pos){
                feedreaderGetHash(article,function(){
                  if ((hash = JSON.parse(this.responseText).hash)) feedreaderLabelUnread(hash)
                  return false
                })
              })
            })
          })
        })
      })
    })
  })
}
