package analytics

import (
	"regexp"
	"strings"
)

// botRE matches user agents of crawlers, link-preview fetchers, headless
// browsers and HTTP libraries (docs/03 §4.5). Their views are ignored.
var botRE = regexp.MustCompile(`(?i)bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|go-http-client|lighthouse|pagespeed`)

// IsBot reports whether ua looks automated. An empty user agent counts as a bot.
func IsBot(ua string) bool {
	ua = strings.TrimSpace(ua)
	return ua == "" || botRE.MatchString(ua)
}
