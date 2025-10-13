package feedfetcher

import (
	"crypto/md5"
	"encoding/hex"
	"time"
)

// Article represents a feed article with required fields
type Article struct {
	GUID        string `json:"guid" yaml:"guid"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
	PubDate     string `json:"pubDate,omitempty" yaml:"pubDate,omitempty"`
	Pubdate     string `json:"pubdate,omitempty" yaml:"pubdate,omitempty"`
	Date        string `json:"date,omitempty" yaml:"date,omitempty"`
	Hash        string `json:"hash,omitempty" yaml:"hash,omitempty"`
	Score       int64  `json:"score,omitempty" yaml:"score,omitempty"`
	FeedURL     string `json:"feedurl,omitempty" yaml:"feedurl,omitempty"`
}

// Hash generates MD5 hash of article GUID
// Reference: api/src/lib/articleUtils.js hash() function
func Hash(article Article) string {
	hasher := md5.New()
	hasher.Write([]byte(article.GUID))
	return hex.EncodeToString(hasher.Sum(nil))
}

// Score generates score (timestamp) for article
// Reference: api/src/lib/articleUtils.js score() function
func Score(article Article) int64 {
	// Try pubDate, pubdate, date in order
	articleDate := article.PubDate
	if articleDate == "" {
		articleDate = article.Pubdate
	}
	if articleDate == "" {
		articleDate = article.Date
	}

	// Try to parse the date
	if articleDate != "" {
		// Try RFC3339 format first (ISO 8601)
		t, err := time.Parse(time.RFC3339, articleDate)
		if err == nil {
			return t.UnixMilli()
		}
	}

	// If no valid date, return current time
	return time.Now().UnixMilli()
}
