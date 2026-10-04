package analytics

import "testing"

func TestIsBot(t *testing.T) {
	cases := []struct {
		ua  string
		bot bool
	}{
		{"", true},
		{"   ", true},
		{"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true},
		{"Mozilla/5.0 (compatible; bingbot/2.0)", true},
		{"facebookexternalhit/1.1", true},
		{"WhatsApp/2.23.20.0", true},
		{"TelegramBot (like TwitterBot)", true},
		{"curl/8.4.0", true},
		{"Wget/1.21", true},
		{"python-requests/2.31", true},
		{"Go-http-client/1.1", true},
		{"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0", true},
		{"Mozilla/5.0 (Linux; Android 10) Chrome-Lighthouse", true},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", false},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", false},
		{"Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0", false},
	}
	for _, c := range cases {
		if got := IsBot(c.ua); got != c.bot {
			t.Errorf("IsBot(%q) = %v, want %v", c.ua, got, c.bot)
		}
	}
}
