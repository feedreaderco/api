package feeds

import (
	"crypto/md5"
	"encoding/hex"
)

// Article represents a feed article with required fields
type Article struct {
	GUID        string    `json:"guid"`
	Title       string    `json:"title,omitempty"`
	Description string    `json:"description,omitempty"`
	PubDate     string    `json:"pubDate,omitempty"`
	Pubdate     string    `json:"pubdate,omitempty"`
	Date        string    `json:"date,omitempty"`
	Hash        string    `json:"hash,omitempty"`
	Score       int64     `json:"score,omitempty"`
	FeedURL     string    `json:"feedurl,omitempty"`
}

// Hash generates MD5 hash of article GUID
// Reference: api/src/lib/articleUtils.js hash() function
func Hash(article Article) string {
	hasher := md5.New()
	hasher.Write([]byte(article.GUID))
	return hex.EncodeToString(hasher.Sum(nil))
}
