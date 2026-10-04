// Package richtext sanitizes editor HTML (Tiptap output) and derives plain
// text, reading time and excerpts from it.
//
// Sanitize is the XSS boundary for every piece of stored HTML that is later
// rendered with dangerouslySetInnerHTML on the public site. It must run on
// write (before persisting) and its output is considered trusted.
package richtext

import (
	"bytes"
	"io"
	"math"
	"regexp"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"github.com/microcosm-cc/bluemonday"
	"golang.org/x/net/html"
)

var (
	policiesOnce sync.Once
	bodyPolicy   *bluemonday.Policy
	inlinePolicy *bluemonday.Policy
)

func policies() (*bluemonday.Policy, *bluemonday.Policy) {
	policiesOnce.Do(func() {
		bodyPolicy = newBodyPolicy()
		inlinePolicy = newInlinePolicy()
	})
	return bodyPolicy, inlinePolicy
}

// youtubeHostRe matches the regular YouTube embed host as written by the
// Tiptap YouTube extension so it can be rewritten to the privacy-enhanced
// host before sanitizing. Anything it does not match is left to the policy,
// which only accepts youtube-nocookie embeds.
var youtubeHostRe = regexp.MustCompile(`(?i)https?://(?:www\.)?youtube\.com/embed/`)

// Sanitize cleans rich-text HTML with the article body policy. It returns ""
// for empty or whitespace-only results.
func Sanitize(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	body, _ := policies()
	s = youtubeHostRe.ReplaceAllString(s, "https://www.youtube-nocookie.com/embed/")
	out := body.Sanitize(s)
	out = dropSrcless(out)
	return strings.TrimSpace(out)
}

// SanitizeInline cleans short inline HTML (FAQ answers, snippet bodies):
// only b, i, em, strong, a[href] and br survive.
func SanitizeInline(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	_, inline := policies()
	return strings.TrimSpace(inline.Sanitize(s))
}

// YouTubeEmbedURL returns the privacy-enhanced embed URL for a video id.
func YouTubeEmbedURL(id string) string {
	return "https://www.youtube-nocookie.com/embed/" + id
}

// dropSrcless removes <img> and <iframe> elements whose src was rejected by
// the policy (bluemonday keeps an element as long as any attribute
// survives) and discards any content inside iframes. Input is already
// sanitized, so re-serialising tokens is safe.
func dropSrcless(s string) string {
	if !strings.Contains(s, "<img") && !strings.Contains(s, "<iframe") {
		return s
	}
	z := html.NewTokenizer(strings.NewReader(s))
	var buf bytes.Buffer
	dropIframeEnd := 0
	inIframe := false
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			if z.Err() == io.EOF {
				return buf.String()
			}
			return ""
		}
		tok := z.Token()
		switch tt {
		case html.TextToken:
			if inIframe {
				continue
			}
		case html.StartTagToken, html.SelfClosingTagToken:
			if tok.Data == "iframe" && tt == html.StartTagToken {
				inIframe = true
			}
			if (tok.Data == "img" || tok.Data == "iframe") && !hasAttr(tok, "src") {
				if tok.Data == "iframe" && tt == html.StartTagToken {
					dropIframeEnd++
				}
				continue
			}
		case html.EndTagToken:
			if tok.Data == "iframe" {
				inIframe = false
			}
			if tok.Data == "iframe" && dropIframeEnd > 0 {
				dropIframeEnd--
				continue
			}
		}
		buf.WriteString(tok.String())
	}
}

func hasAttr(tok html.Token, key string) bool {
	for _, a := range tok.Attr {
		if a.Key == key && a.Val != "" {
			return true
		}
	}
	return false
}

// blockElements end a paragraph in Text output.
var blockElements = map[string]bool{
	"p": true, "div": true, "h1": true, "h2": true, "h3": true, "h4": true,
	"h5": true, "h6": true, "ul": true, "ol": true, "li": true,
	"blockquote": true, "pre": true, "figure": true, "figcaption": true,
	"table": true, "thead": true, "tbody": true, "tfoot": true, "tr": true,
	"hr": true, "section": true, "article": true, "header": true,
	"footer": true, "aside": true, "dl": true, "dt": true, "dd": true,
}

// skipContentElements never contribute text.
var skipContentElements = map[string]bool{
	"script": true, "style": true, "iframe": true, "noscript": true,
	"template": true, "object": true, "svg": true, "math": true,
	"head": true, "title": true, "textarea": true, "select": true,
}

// Text strips tags and returns plain text. Block elements are separated by a
// blank line ("\n\n"), <br> becomes "\n", entities are decoded and runs of
// whitespace inside a line are collapsed to one space.
func Text(s string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	z := html.NewTokenizer(strings.NewReader(s))
	var (
		paras []string
		cur   strings.Builder
		skip  = 0
	)
	flush := func() {
		if p := normalizeParagraph(cur.String()); p != "" {
			paras = append(paras, p)
		}
		cur.Reset()
	}
loop:
	for {
		tt := z.Next()
		switch tt {
		case html.ErrorToken:
			break loop
		case html.TextToken:
			if skip == 0 {
				// Source line breaks are insignificant; only <br> breaks lines.
				cur.WriteString(strings.Map(func(r rune) rune {
					if r == '\n' || r == '\r' {
						return ' '
					}
					return r
				}, string(z.Text())))
			}
		case html.StartTagToken, html.SelfClosingTagToken:
			name, _ := z.TagName()
			tag := string(name)
			if skipContentElements[tag] {
				if tt == html.StartTagToken {
					skip++
				}
				continue
			}
			if tag == "br" {
				cur.WriteByte('\n')
			} else if blockElements[tag] {
				flush()
			} else if tag == "td" || tag == "th" || tag == "img" {
				cur.WriteByte(' ')
			}
		case html.EndTagToken:
			name, _ := z.TagName()
			tag := string(name)
			if skipContentElements[tag] {
				if skip > 0 {
					skip--
				}
				continue
			}
			if blockElements[tag] {
				flush()
			} else if tag == "td" || tag == "th" {
				cur.WriteByte(' ')
			}
		}
	}
	flush()
	return strings.Join(paras, "\n\n")
}

// normalizeParagraph collapses whitespace within each line and drops empty
// lines.
func normalizeParagraph(s string) string {
	lines := strings.Split(s, "\n")
	out := lines[:0]
	for _, l := range lines {
		if f := strings.Fields(l); len(f) > 0 {
			out = append(out, strings.Join(f, " "))
		}
	}
	return strings.Join(out, "\n")
}

// ReadingMinutes estimates reading time at 200 words per minute, minimum 1.
func ReadingMinutes(text string) int16 {
	words := len(strings.Fields(text))
	m := (words + 199) / 200
	if m < 1 {
		return 1
	}
	if m > math.MaxInt16 {
		return math.MaxInt16
	}
	return int16(m)
}

// Excerpt returns a plain-text summary of at most max runes. It prefers
// whole sentences; otherwise it cuts at a word boundary and appends "…".
func Excerpt(text string, max int) string {
	if max <= 0 {
		return ""
	}
	t := strings.Join(strings.Fields(text), " ")
	if utf8.RuneCountInString(t) <= max {
		return t
	}
	r := []rune(t)

	// Whole sentences: last sentence end within the limit, if it keeps at
	// least a third of the budget.
	best := -1
	for i := 0; i < max && i < len(r); i++ {
		if r[i] == '.' || r[i] == '!' || r[i] == '?' {
			if i+1 < len(r) && r[i+1] == ' ' {
				best = i + 1
			}
		}
	}
	if best > 0 && best >= max/3 {
		return string(r[:best])
	}

	// Word boundary, reserving one rune for the ellipsis.
	limit := max - 1
	cut := -1
	for i := limit; i > 0; i-- {
		if r[i] == ' ' {
			cut = i
			break
		}
	}
	var head string
	if cut > 0 {
		head = string(r[:cut])
	} else {
		head = string(r[:limit])
	}
	head = strings.TrimRightFunc(head, func(c rune) bool {
		return unicode.IsSpace(c) || strings.ContainsRune(",;:-–—", c)
	})
	return head + "…"
}
