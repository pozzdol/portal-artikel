package richtext

import (
	"regexp"

	"github.com/microcosm-cc/bluemonday"
)

// Attribute value patterns. They are matched against the tokenizer-decoded
// attribute value (entities already resolved), so entity obfuscation cannot
// slip past them. URL attributes (href/src) are additionally validated by
// bluemonday against the allowed schemes.
var (
	// uploadSrcRe accepts only same-origin media paths. Every segment must
	// start with an alphanumeric, "_" or "-", so ".." and "//" can never occur.
	uploadSrcRe = regexp.MustCompile(`^/uploads/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$`)

	// youtubeSrcRe accepts only privacy-enhanced YouTube embeds with a plain
	// 11-character video id and an optional simple query string.
	youtubeSrcRe = regexp.MustCompile(`^https://www\.youtube-nocookie\.com/embed/[A-Za-z0-9_-]{11}(?:\?[a-z0-9_=&-]*)?$`)

	classRe     = regexp.MustCompile(`^(?:text-(?:left|center|right)|align-(?:left|center|right)|youtube|image|caption|lead)$`)
	codeClassRe = regexp.MustCompile(`^language-[a-z0-9+#-]{1,32}$`)
	relRe       = regexp.MustCompile(`^(?:noopener|noreferrer|nofollow|ugc)(?: (?:noopener|noreferrer|nofollow|ugc))*$`)
	dimensionRe = regexp.MustCompile(`^[0-9]{1,4}(?:%|px)?$`)
	smallIntRe  = regexp.MustCompile(`^[0-9]{1,3}$`)
	allowRe     = regexp.MustCompile(`^[a-z; -]{0,200}$`)
	boolAttrRe  = regexp.MustCompile(`^(?:|true|allowfullscreen)$`)
	loadingRe   = regexp.MustCompile(`^(?:lazy|eager)$`)
	textAlignRe = regexp.MustCompile(`^(?:left|center|right)$`)
)

// newBodyPolicy builds the policy for article bodies and rich-text homepage
// blocks. Everything not explicitly allowed is stripped: no style, no event
// handlers, no id, no data-*, no srcset, no SVG/MathML, no forms.
func newBodyPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	p.RequireParseableURLs(true)
	p.AllowURLSchemes("http", "https", "mailto")
	p.AllowRelativeURLs(true)
	p.RequireNoFollowOnLinks(false)
	p.AddTargetBlankToFullyQualifiedLinks(true)

	p.AllowElements(
		"p", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
		"ul", "ol", "li", "blockquote", "hr", "br",
		"figure", "figcaption", "pre", "code",
		"table", "thead", "tbody", "tr", "th", "td", "span",
	)

	// Links.
	p.AllowAttrs("href").OnElements("a")
	p.AllowAttrs("rel").Matching(relRe).OnElements("a")
	p.AllowAttrs("title").OnElements("a")

	// Images: same-origin uploads only.
	p.AllowAttrs("src").Matching(uploadSrcRe).OnElements("img")
	p.AllowAttrs("alt", "title").OnElements("img")
	p.AllowAttrs("width", "height").Matching(dimensionRe).OnElements("img")

	// Embeds: youtube-nocookie only.
	p.AllowAttrs("src").Matching(youtubeSrcRe).OnElements("iframe")
	p.AllowAttrs("allow").Matching(allowRe).OnElements("iframe")
	p.AllowAttrs("allowfullscreen").Matching(boolAttrRe).OnElements("iframe")
	p.AllowAttrs("frameborder").Matching(smallIntRe).OnElements("iframe")
	p.AllowAttrs("width", "height").Matching(dimensionRe).OnElements("iframe")
	p.AllowAttrs("loading").Matching(loadingRe).OnElements("iframe")
	p.AllowAttrs("title").OnElements("iframe")

	// Presentation hooks (fixed vocabulary).
	p.AllowAttrs("class").Matching(classRe).OnElements("p", "span", "figure", "img", "iframe")
	p.AllowAttrs("class").Matching(codeClassRe).OnElements("code")

	// Lists and tables.
	p.AllowAttrs("start").Matching(smallIntRe).OnElements("ol")
	p.AllowAttrs("colspan", "rowspan").Matching(smallIntRe).OnElements("th", "td")
	p.AllowAttrs("align").Matching(textAlignRe).OnElements("th", "td")

	// bluemonday only keeps elements that have at least one attribute unless
	// they are explicitly allowed without attributes; img/iframe must keep
	// their src, so they are only listed through AllowAttrs above and are
	// dropped when src is rejected. "a" without href is harmless text.
	p.AllowNoAttrs().OnElements("a")

	return p
}

// newInlinePolicy builds the policy for short inline texts (FAQ answers,
// snippet bodies): b, i, em, strong, a[href], br only.
func newInlinePolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	p.RequireParseableURLs(true)
	p.AllowURLSchemes("http", "https", "mailto")
	p.AllowRelativeURLs(true)
	p.RequireNoFollowOnLinks(false)
	p.AddTargetBlankToFullyQualifiedLinks(true)

	p.AllowElements("b", "i", "em", "strong", "br")
	p.AllowAttrs("href").OnElements("a")
	p.AllowNoAttrs().OnElements("a")

	return p
}
