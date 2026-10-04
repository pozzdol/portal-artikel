package richtext

import (
	"net/url"
	"strings"
	"testing"
	"unicode/utf8"

	"golang.org/x/net/html"
)

// allowedBody lists, per element, the attributes the body policy may emit.
var allowedBody = map[string]map[string]bool{
	"p": {"class": true}, "h2": {}, "h3": {}, "h4": {}, "strong": {}, "b": {},
	"em": {}, "i": {}, "u": {}, "s": {}, "a": {"href": true, "rel": true, "title": true, "target": true},
	"ul": {}, "ol": {"start": true}, "li": {}, "blockquote": {}, "hr": {}, "br": {},
	"img":        {"src": true, "alt": true, "title": true, "width": true, "height": true, "class": true},
	"figure":     {"class": true},
	"figcaption": {},
	"iframe": {"src": true, "allow": true, "allowfullscreen": true, "frameborder": true,
		"width": true, "height": true, "title": true, "loading": true, "class": true},
	"pre": {}, "code": {"class": true}, "table": {}, "thead": {}, "tbody": {}, "tr": {},
	"th":   {"colspan": true, "rowspan": true, "align": true},
	"td":   {"colspan": true, "rowspan": true, "align": true},
	"span": {"class": true},
}

var allowedInline = map[string]map[string]bool{
	"b": {}, "i": {}, "em": {}, "strong": {}, "br": {},
	"a": {"href": true, "rel": true, "target": true},
}

// assertSafe re-parses sanitizer output the way a browser tokenizer would
// and fails on any element/attribute/URL outside the allow list.
func assertSafe(t *testing.T, in, out string, allowed map[string]map[string]bool) {
	t.Helper()
	z := html.NewTokenizer(strings.NewReader(out))
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			return
		}
		switch tt {
		case html.CommentToken, html.DoctypeToken:
			t.Errorf("input %q: output contains comment/doctype: %q", in, out)
		case html.StartTagToken, html.SelfClosingTagToken, html.EndTagToken:
			tok := z.Token()
			attrs, ok := allowed[tok.Data]
			if !ok {
				t.Errorf("input %q: disallowed element <%s> in %q", in, tok.Data, out)
				continue
			}
			for _, a := range tok.Attr {
				if !attrs[a.Key] {
					t.Errorf("input %q: disallowed attr %s on <%s> in %q", in, a.Key, tok.Data, out)
				}
				if a.Namespace != "" {
					t.Errorf("input %q: namespaced attr in %q", in, out)
				}
				switch a.Key {
				case "href":
					assertSafeURL(t, in, a.Val)
				case "src":
					switch tok.Data {
					case "img":
						if !uploadSrcRe.MatchString(a.Val) {
							t.Errorf("input %q: img src %q not an upload", in, a.Val)
						}
					case "iframe":
						if !strings.HasPrefix(a.Val, "https://www.youtube-nocookie.com/embed/") {
							t.Errorf("input %q: iframe src %q not nocookie", in, a.Val)
						}
					}
				case "target":
					if a.Val != "_blank" {
						t.Errorf("input %q: target %q", in, a.Val)
					}
				}
			}
		}
	}
}

func assertSafeURL(t *testing.T, in, raw string) {
	t.Helper()
	low := strings.ToLower(raw)
	for _, bad := range []string{"javascript:", "vbscript:", "data:", "livescript:", "file:"} {
		if strings.Contains(low, bad) {
			t.Errorf("input %q: dangerous URL %q", in, raw)
		}
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Errorf("input %q: unparseable URL %q", in, raw)
		return
	}
	switch u.Scheme {
	case "", "http", "https", "mailto":
	default:
		t.Errorf("input %q: scheme %q", in, u.Scheme)
	}
}

func TestSanitizeAdversarial(t *testing.T) {
	payloads := []string{
		// script & raw-text tricks
		`<script>alert(1)</script>`,
		`<SCRIPT SRC=//evil.example/x.js></SCRIPT>`,
		`<scr<script>ipt>alert(1)</scr</script>ipt>`,
		`<<script>script>alert(1)//<</script>/script>`,
		`<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
		`<textarea><img src=x onerror=alert(1)></textarea>`,
		`<title><img src=x onerror=alert(1)></title>`,
		`<template><img src=x onerror=alert(1)></template>`,
		`<!--<img src=x onerror=alert(1)>-->`,
		`<![CDATA[<img src=x onerror=alert(1)>]]>`,
		`<xmp><img src=x onerror=alert(1)></xmp>`,
		// event handlers
		`<img src="/uploads/a.jpg" onerror="alert(1)">`,
		`<img src=/uploads/a.jpg ONERROR=alert(1)>`,
		`<p onclick="alert(1)" onmouseover=alert(1)>x</p>`,
		`<a href="/x" onfocus=alert(1) autofocus>x</a>`,
		`<body onload=alert(1)>`,
		`<details open ontoggle=alert(1)>`,
		`<p/onclick=alert(1)>x</p>`,
		`<img src="/uploads/a.jpg"/onerror=alert(1)>`,
		// javascript/vbscript/data URLs with obfuscation
		`<a href="javascript:alert(1)">x</a>`,
		`<a href="JaVaScRiPt:alert(1)">x</a>`,
		`<a href=" javascript:alert(1)">x</a>`,
		`<a href="java&#x09;script:alert(1)">x</a>`,
		`<a href="java&#10;script:alert(1)">x</a>`,
		`<a href="java&#13;script:alert(1)">x</a>`,
		`<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>`,
		`<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3A;alert(1)">x</a>`,
		`<a href="javascript&colon;alert(1)">x</a>`,
		`<a href="&#0000106avascript:alert(1)">x</a>`,
		`<a href="\x01javascript:alert(1)">x</a>`,
		"<a href=\"\x00javascript:alert(1)\">x</a>",
		`<a href="vbscript:msgbox(1)">x</a>`,
		`<a href="VBScript:msgbox(1)">x</a>`,
		`<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`,
		`<a href="DATA:text/html,<script>alert(1)</script>">x</a>`,
		`<a href="livescript:alert(1)">x</a>`,
		`<a href="file:///etc/passwd">x</a>`,
		`<img src="javascript:alert(1)">`,
		`<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">`,
		`<img src="data:image/png;base64,iVBORw0KGgo=">`,
		`<img src="https://evil.example/a.png">`,
		`<img src="//evil.example/uploads/a.png">`,
		`<img src="/uploads/../admin/x.png">`,
		`<img src="/uploads//evil.example/a.png">`,
		`<img src="/uploadsx/a.png">`,
		`<img src="/uploads/a.png?x=javascript:alert(1)">`,
		`<img srcset="https://evil.example/a.png 1x, /uploads/a.png 2x" src="/uploads/a.png">`,
		`<img src="/uploads/a.png" style="width:expression(alert(1))">`,
		// SVG / MathML
		`<svg onload=alert(1)><script>alert(1)</script></svg>`,
		`<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>`,
		`<svg><animate onbegin=alert(1) attributeName=x dur=1s>`,
		`<svg><use href="data:image/svg+xml,<svg id='x' xmlns='http://www.w3.org/2000/svg'><image href='1' onerror='alert(1)' /></svg>#x"></use></svg>`,
		`<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>`,
		`<math href="javascript:alert(1)">x</math>`,
		`<math><maction actiontype="statusline" xlink:href="javascript:alert(1)">x</maction></math>`,
		// iframes / embeds
		`<iframe src="https://evil.example/embed/dQw4w9WgXcQ"></iframe>`,
		`<iframe src="https://player.vimeo.com/video/123"></iframe>`,
		`<iframe src="javascript:alert(1)"></iframe>`,
		`<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
		`<iframe src="https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ"></iframe>`,
		`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ/../../x"></iframe>`,
		`<iframe src="http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>`,
		`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" onload="alert(1)"></iframe>`,
		`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"><img src=x onerror=alert(1)></iframe>`,
		`<object data="javascript:alert(1)"></object>`,
		`<embed src="javascript:alert(1)">`,
		`<frameset><frame src="javascript:alert(1)"></frameset>`,
		// CSS / style
		`<style>body{background:url(javascript:alert(1))}</style>`,
		`<p style="background:url(javascript:alert(1))">x</p>`,
		`<span style="position:fixed;top:0;left:0;width:100%;height:100%">x</span>`,
		`<link rel="stylesheet" href="https://evil.example/x.css">`,
		`<p class="fixed inset-0 z-50">x</p>`,
		`<p class="lead evil">x</p>`,
		// forms
		`<form action="https://evil.example"><input name="password" type="password"><button formaction="javascript:alert(1)">go</button></form>`,
		`<input autofocus onfocus=alert(1)>`,
		`<select><option>x</option></select>`,
		`<textarea autofocus onfocus=alert(1)>x</textarea>`,
		`<isindex action=javascript:alert(1) type=image>`,
		// base / meta
		`<base href="https://evil.example/">`,
		`<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`,
		`<meta charset="utf-7">+ADw-script+AD4-alert(1)+ADw-/script+AD4-`,
		// misc attrs
		`<p id="__next" data-x="1" dir="rtl" lang="ar">x</p>`,
		`<a href="/x" target="_self">x</a>`,
		`<a href="/x" rel="opener">x</a>`,
		`<a href="https://example.com" target="_top">x</a>`,
		`<a href="/x" ping="https://evil.example">x</a>`,
		`<a href="/x" formaction="javascript:alert(1)">x</a>`,
		`<code class="language-go onmouseover=alert(1)">x</code>`,
		`<td colspan="1 onmouseover=alert(1)">x</td>`,
		`<img src="/uploads/a.png" width="100 onerror=alert(1)">`,
		`<a href="https://example.com/" title='"><script>alert(1)</script>'>x</a>`,
		`<img src="/uploads/a.png" alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">`,
		`<mark>x</mark><font color=red>x</font><center>x</center><marquee>x</marquee>`,
		`<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?start=5" style="x"></iframe></div>`,
		`<h1>Big</h1><h5>x</h5><h6>y</h6>`,
		`<video src="/uploads/a.mp4" poster="javascript:alert(1)"></video><audio src=x onerror=alert(1)>`,
	}
	for _, in := range payloads {
		out := Sanitize(in)
		assertSafe(t, in, out, allowedBody)
		low := strings.ToLower(out)
		for _, bad := range []string{"<script", "javascript:", "vbscript:", "data:", "style=", "onerror", "onload", "onclick", "srcset", "<svg", "<math", "<form", "<input", "<base", "<meta", "<style", "<link", "<object", "<embed", "evil.example", "expression("} {
			// Escaped text (e.g. "&lt;img ... onerror=...&gt;") is inert;
			// only flag occurrences outside escaped text.
			if strings.Contains(low, bad) && !onlyInEscapedText(out, bad) {
				t.Errorf("input %q: output contains %q: %q", in, bad, out)
			}
		}
		inl := SanitizeInline(in)
		assertSafe(t, in, inl, allowedInline)
	}
}

// onlyInEscapedText reports whether every occurrence of needle is inside a
// text node (where the tokenizer would treat it as inert characters).
func onlyInEscapedText(out, needle string) bool {
	z := html.NewTokenizer(strings.NewReader(out))
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			return true
		}
		if tt == html.TextToken {
			continue
		}
		if strings.Contains(strings.ToLower(string(z.Raw())), needle) {
			return false
		}
	}
}

func TestSanitizeExpected(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"empty", "", ""},
		{"whitespace", "  \n ", ""},
		{"script removed with content", `<p>a</p><script>alert(1)</script>`, `<p>a</p>`},
		{"onerror stripped keeps img", `<img src="/uploads/2026/09/a.webp" alt="A" onerror="alert(1)">`, `<img src="/uploads/2026/09/a.webp" alt="A">`},
		{"javascript href dropped", `<a href="javascript:alert(1)">x</a>`, `<a>x</a>`},
		{"obfuscated javascript href dropped", `<a href="jAvA&#x09;sCrIpt:alert(1)">x</a>`, `<a>x</a>`},
		{"data img dropped entirely", `<p>x<img src="data:image/png;base64,AAAA" alt="a"></p>`, `<p>x</p>`},
		{"external img dropped entirely", `<img src="https://evil.example/a.png" alt="a" width="10">`, ``},
		{"traversal img dropped", `<img src="/uploads/../x.png">`, ``},
		{"relative link kept", `<a href="/kajian/abc">x</a>`, `<a href="/kajian/abc">x</a>`},
		{"external link target blank noopener", `<a href="https://example.com/a">x</a>`, `<a href="https://example.com/a" target="_blank" rel="noopener">x</a>`},
		{"mailto kept", `<a href="mailto:a@b.id">x</a>`, `<a href="mailto:a@b.id">x</a>`},
		{"rel restricted", `<a href="/x" rel="opener">x</a>`, `<a href="/x">x</a>`},
		{"youtube rewritten", `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen="true" frameborder="0" width="640" height="480"></iframe>`,
			`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" allowfullscreen="true" frameborder="0" width="640" height="480"></iframe>`},
		{"youtube with query", `<iframe src="https://youtube.com/embed/dQw4w9WgXcQ?start=30&amp;rel=0"></iframe>`,
			`<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&amp;rel=0"></iframe>`},
		{"nocookie kept", `<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>`, `<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>`},
		{"vimeo dropped", `<p>a</p><iframe src="https://player.vimeo.com/video/123" width="640"></iframe>`, `<p>a</p>`},
		{"bad youtube id dropped", `<iframe src="https://www.youtube-nocookie.com/embed/short" title="t"></iframe>`, ``},
		{"iframe content dropped", `<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk">fallback</iframe>`, `<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>`},
		{"style stripped", `<p style="color:red">x</p>`, `<p>x</p>`},
		{"id data stripped", `<p id="a" data-x="1">x</p>`, `<p>x</p>`},
		{"class allowed", `<p class="lead">x</p>`, `<p class="lead">x</p>`},
		{"class rejected", `<p class="lead evil">x</p>`, `<p>x</p>`},
		{"code language class", `<pre><code class="language-go">x := 1</code></pre>`, `<pre><code class="language-go">x := 1</code></pre>`},
		{"nested lists kept", `<ul><li>a<ul><li>b</li></ul></li></ul><ol start="3"><li>c</li></ol>`, `<ul><li>a<ul><li>b</li></ul></li></ul><ol start="3"><li>c</li></ol>`},
		{"mark removed text kept", `<p><mark>x</mark></p>`, `<p>x</p>`},
		{"h1 downgraded to text", `<h1>T</h1>`, `T`},
		{"unicode and entities", `<p>Qur&#39;an &amp; ‘Ilmu’ — سلام &copy;</p>`, `<p>Qur&#39;an &amp; ‘Ilmu’ — سلام ©</p>`},
		{"table", `<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>`,
			`<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>`},
		{"figure", `<figure class="image"><img src="/uploads/a.jpg" alt="a"><figcaption>c</figcaption></figure>`, `<figure class="image"><img src="/uploads/a.jpg" alt="a"><figcaption>c</figcaption></figure>`},
		{"comment removed", `<p>a<!-- x --></p>`, `<p>a</p>`},
		{"form removed", `<form action="/x"><input name="q"><p>t</p></form>`, `<p>t</p>`},
		{"svg removed", `<p>a</p><svg><circle r="1"/></svg>`, `<p>a</p>`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Sanitize(c.in); got != c.want {
				t.Errorf("Sanitize(%q)\n got  %q\n want %q", c.in, got, c.want)
			}
		})
	}
}

func TestSanitizeIdempotent(t *testing.T) {
	in := `<p class="lead">Hi <a href="https://example.com">x</a></p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><img src="/uploads/a.jpg" alt="a &amp; b">`
	// bluemonday may reorder rel/target on the first re-run, so assert a
	// fixpoint from the second pass on and that the output stays safe.
	once := Sanitize(in)
	twice := Sanitize(once)
	if thrice := Sanitize(twice); thrice != twice {
		t.Errorf("not stable:\n %q\n %q", twice, thrice)
	}
	if strings.ReplaceAll(strings.ReplaceAll(once, ` rel="noopener"`, ""), ` target="_blank"`, "") !=
		strings.ReplaceAll(strings.ReplaceAll(twice, ` rel="noopener"`, ""), ` target="_blank"`, "") {
		t.Errorf("second pass changed content:\n %q\n %q", once, twice)
	}
	assertSafe(t, in, twice, allowedBody)
}

func TestSanitizeInline(t *testing.T) {
	cases := []struct{ in, want string }{
		{``, ``},
		{`<b>a</b> <i>b</i> <em>c</em> <strong>d</strong><br>e`, `<b>a</b> <i>b</i> <em>c</em> <strong>d</strong><br>e`},
		{`<p>para</p>`, `para`},
		{`<a href="/faq" class="x" title="t">x</a>`, `<a href="/faq">x</a>`},
		{`<a href="javascript:alert(1)">x</a>`, `<a>x</a>`},
		{`<img src="/uploads/a.jpg">x`, `x`},
		{`<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>`, ``},
		{`<u>u</u><span class="lead">s</span>`, `us`},
		{`<script>alert(1)</script>ok`, `ok`},
	}
	for _, c := range cases {
		if got := SanitizeInline(c.in); got != c.want {
			t.Errorf("SanitizeInline(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestText(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"empty", ``, ``},
		{"multi block", `<h2>Judul</h2><p>Satu   dua
 tiga.</p><ul><li>a</li><li>b</li></ul><blockquote><p>kutip</p></blockquote>`,
			"Judul\n\nSatu dua tiga.\n\na\n\nb\n\nkutip"},
		{"inline joins", `<p>a<strong>b</strong> <em>c</em></p>`, "ab c"},
		{"br newline", `<p>a<br>b<br/>  c</p>`, "a\nb\nc"},
		{"entities decoded", `<p>Qur&#39;an &amp; &quot;x&quot; &nbsp;y &lt;z&gt;</p>`, "Qur'an & \"x\" y <z>"},
		{"script style skipped", `<p>a</p><script>var x=1</script><style>p{}</style><p>b</p>`, "a\n\nb"},
		{"iframe skipped", `<p>a</p><iframe src="x">fallback</iframe>`, "a"},
		{"table cells", `<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>`, "a b\n\nc"},
		{"plain text", `hello   world`, "hello world"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Text(c.in); got != c.want {
				t.Errorf("Text(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestReadingMinutes(t *testing.T) {
	words := func(n int) string { return strings.TrimSpace(strings.Repeat("kata ", n)) }
	cases := []struct {
		n    int
		want int16
	}{{0, 1}, {1, 1}, {199, 1}, {200, 1}, {201, 2}, {400, 2}, {401, 3}, {1000, 5}}
	for _, c := range cases {
		if got := ReadingMinutes(words(c.n)); got != c.want {
			t.Errorf("ReadingMinutes(%d words) = %d, want %d", c.n, got, c.want)
		}
	}
}

func TestExcerpt(t *testing.T) {
	cases := []struct {
		name string
		in   string
		max  int
		want string
	}{
		{"short unchanged", "Halo dunia.", 300, "Halo dunia."},
		{"whitespace collapsed", "Halo \n\n dunia.", 300, "Halo dunia."},
		{"zero max", "abc", 0, ""},
		{"whole sentences", "Kalimat pertama. Kalimat kedua panjang sekali di sini.", 30, "Kalimat pertama."},
		{"word boundary", "satu dua tiga empat lima enam", 15, "satu dua tiga…"},
		{"trailing comma trimmed", "satu dua, tiga empat lima", 11, "satu dua…"},
		{"no space hard cut", "abcdefghijklmnop", 5, "abcd…"},
		{"short sentence ignored", "A. bbbbbbbbbb cccccccccc dddddddddd", 30, "A. bbbbbbbbbb cccccccccc…"},
		{"unicode runes", "سلام عليكم ورحمة الله وبركاته", 12, "سلام عليكم…"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := Excerpt(c.in, c.max)
			if got != c.want {
				t.Errorf("Excerpt(%q, %d) = %q, want %q", c.in, c.max, got, c.want)
			}
			if utf8.RuneCountInString(got) > c.max {
				t.Errorf("Excerpt exceeds max: %d > %d", utf8.RuneCountInString(got), c.max)
			}
		})
	}
}

func TestYouTubeEmbedURL(t *testing.T) {
	got := YouTubeEmbedURL("dQw4w9WgXcQ")
	if got != "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" || !youtubeSrcRe.MatchString(got) {
		t.Errorf("YouTubeEmbedURL = %q", got)
	}
}

func TestSanitizeConcurrent(t *testing.T) {
	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for j := 0; j < 50; j++ {
				if got := Sanitize(`<p onclick=x>a</p>`); got != `<p>a</p>` {
					t.Errorf("got %q", got)
				}
			}
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
}
