// Package slugutil builds and validates URL slugs shared by every content type.
package slugutil

import (
	"regexp"
	"slices"
	"strings"
)

// MaxLen is the maximum slug length (DB CHECK char_length(slug) <= 160).
const MaxLen = 160

var slugRe = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// Reserved lists level-1 path segments owned by site routes. A level-1
// category slug must not be one of these (mirrors the CHECK constraint
// categories_slug_not_reserved in migration 00004).
var Reserved = []string{
	"agenda", "tokoh", "video", "tag", "cari", "penulis", "halaman", "admin", "api", "uploads",
	"sitemap.xml", "robots.txt", "feed", "_next",
}

// diacritics maps common accented Latin letters to their ASCII base.
var diacritics = map[rune]string{
	'à': "a", 'á': "a", 'â': "a", 'ã': "a", 'ä': "a", 'å': "a", 'ā': "a", 'ă': "a", 'ą': "a",
	'ç': "c", 'ć': "c", 'č': "c",
	'ď': "d", 'đ': "d",
	'è': "e", 'é': "e", 'ê': "e", 'ë': "e", 'ē': "e", 'ė': "e", 'ę': "e", 'ě': "e",
	'ğ': "g",
	'ḥ': "h", 'ħ': "h",
	'ì': "i", 'í': "i", 'î': "i", 'ï': "i", 'ī': "i", 'ı': "i",
	'ñ': "n", 'ń': "n", 'ň': "n",
	'ò': "o", 'ó': "o", 'ô': "o", 'õ': "o", 'ö': "o", 'ø': "o", 'ō': "o", 'ő': "o",
	'ř': "r",
	'ś': "s", 'š': "s", 'ş': "s", 'ṣ': "s", 'ß': "ss",
	'ť': "t", 'ṭ': "t",
	'ù': "u", 'ú': "u", 'û': "u", 'ü': "u", 'ū': "u", 'ů': "u", 'ű': "u",
	'ý': "y", 'ÿ': "y",
	'ź': "z", 'ż': "z", 'ž': "z", 'ẓ': "z",
	'æ': "ae", 'œ': "oe",
}

// Make turns s into a URL slug matching ^[a-z0-9]+(?:-[a-z0-9]+)*$ with at
// most MaxLen characters. Apostrophes join words ("Qur'an" -> "quran"),
// common diacritics are folded to ASCII, every other run of characters
// becomes one dash. The result may be empty when s has no usable characters.
func Make(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case diacritics[r] != "":
			b.WriteString(diacritics[r])
			dash = false
		case r == '\'' || r == '’' || r == 'ʼ' || r == 'ʻ':
			// apostrophes join words: "Qur'an" -> "quran"
		default:
			if !dash && b.Len() > 0 {
				b.WriteByte('-')
				dash = true
			}
		}
	}
	out := strings.TrimRight(b.String(), "-")
	if len(out) > MaxLen {
		out = strings.TrimRight(out[:MaxLen], "-")
	}
	return out
}

// Valid reports whether s is a well-formed slug (pattern + max length).
func Valid(s string) bool {
	return len(s) <= MaxLen && slugRe.MatchString(s)
}

// IsReserved reports whether s is a reserved level-1 route segment.
func IsReserved(s string) bool {
	return slices.Contains(Reserved, s)
}
