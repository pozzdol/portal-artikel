package seed

import (
	"encoding/json"
	"html"
	"strings"
	"time"
	"unicode"

	"portal-berita/backend/internal/slugutil"
)

const maxSlugLen = slugutil.MaxLen

// Slugify is the exported slugifier, used by other tools (e.g. create-superadmin).
func Slugify(s string) string { return slugutil.Make(s) }

// slugify turns s into a URL slug (see slugutil.Make).
func slugify(s string) string { return slugutil.Make(s) }

type tiptapNode struct {
	Type    string       `json:"type"`
	Text    string       `json:"text,omitempty"`
	Content []tiptapNode `json:"content,omitempty"`
}

// tiptapDoc builds a Tiptap/ProseMirror document with one paragraph per argument.
func tiptapDoc(paragraphs ...string) json.RawMessage {
	doc := tiptapNode{Type: "doc", Content: []tiptapNode{}}
	for _, p := range paragraphs {
		doc.Content = append(doc.Content, tiptapNode{
			Type:    "paragraph",
			Content: []tiptapNode{{Type: "text", Text: p}},
		})
	}
	raw, err := json.Marshal(doc)
	if err != nil { // cannot happen for plain strings
		panic(err)
	}
	return raw
}

// htmlParagraphs renders paragraphs as escaped <p> elements.
func htmlParagraphs(paragraphs ...string) string {
	var b strings.Builder
	for _, p := range paragraphs {
		b.WriteString("<p>")
		b.WriteString(html.EscapeString(p))
		b.WriteString("</p>")
	}
	return b.String()
}

// plainText joins paragraphs with blank lines (used for FTS and reading time).
func plainText(paragraphs ...string) string {
	return strings.Join(paragraphs, "\n\n")
}

// readingMinutes = max(1, ceil(words/200)).
func readingMinutes(text string) int16 {
	words := len(strings.FieldsFunc(text, unicode.IsSpace))
	m := (words + 199) / 200
	if m < 1 {
		m = 1
	}
	return int16(m)
}

var jakartaLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return loc
}()

// jakarta returns the Asia/Jakarta (WIB) location.
func jakarta() *time.Location { return jakartaLoc }

// daysAgo returns the WIB calendar day n days before now, at hour:min WIB.
func daysAgo(now time.Time, n, hour, min int) time.Time {
	return daysAhead(now, -n, hour, min)
}

// daysAhead returns the WIB calendar day n days after now, at hour:min WIB.
func daysAhead(now time.Time, n, hour, min int) time.Time {
	t := now.In(jakarta())
	return time.Date(t.Year(), t.Month(), t.Day()+n, hour, min, 0, 0, jakarta())
}

// wibDate returns the WIB calendar date (midnight, UTC location) n days after now,
// suitable for DATE columns.
func wibDate(now time.Time, n int) time.Time {
	t := now.In(jakarta())
	return time.Date(t.Year(), t.Month(), t.Day()+n, 0, 0, 0, 0, time.UTC)
}
