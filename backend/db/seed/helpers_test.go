package seed

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"
)

var slugRe = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Menjaga Keikhlasan di Tengah Derasnya Arus Informasi": "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi",
		"Adab Menuntut Ilmu: Bekal Sebelum Melangkah":          "adab-menuntut-ilmu-bekal-sebelum-melangkah",
		"  Syarat & Ketentuan  ":                               "syarat-ketentuan",
		"Dr. H. Asep Suryana":                                  "dr-h-asep-suryana",
		"Al-Qur'an dan Ḥadīṡ":                                  "al-quran-dan-hadi",
		"Café Déjà Vu":                                         "cafe-deja-vu",
		"---":                                                  "",
		"Reuni 2026!!!":                                        "reuni-2026",
	}
	for in, want := range cases {
		if got := slugify(in); got != want {
			t.Errorf("slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSlugifyMaxLengthAndPattern(t *testing.T) {
	long := strings.Repeat("kata panjang ", 40)
	s := slugify(long)
	if len(s) > maxSlugLen {
		t.Fatalf("len = %d, want <= %d", len(s), maxSlugLen)
	}
	if !slugRe.MatchString(s) {
		t.Fatalf("slug %q does not match pattern", s)
	}
}

func TestReadingMinutes(t *testing.T) {
	cases := []struct {
		words int
		want  int16
	}{{0, 1}, {1, 1}, {200, 1}, {201, 2}, {400, 2}, {401, 3}, {1000, 5}}
	for _, c := range cases {
		text := strings.TrimSpace(strings.Repeat("kata ", c.words))
		if got := readingMinutes(text); got != c.want {
			t.Errorf("readingMinutes(%d words) = %d, want %d", c.words, got, c.want)
		}
	}
}

func TestTiptapAndHTML(t *testing.T) {
	raw := tiptapDoc("Satu", "Dua <b>")
	var doc struct {
		Type    string `json:"type"`
		Content []struct {
			Type    string `json:"type"`
			Content []struct{ Type, Text string }
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc.Type != "doc" || len(doc.Content) != 2 || doc.Content[1].Content[0].Text != "Dua <b>" {
		t.Fatalf("unexpected doc: %s", raw)
	}
	if got := htmlParagraphs("Satu", "Dua <b>"); got != "<p>Satu</p><p>Dua &lt;b&gt;</p>" {
		t.Fatalf("htmlParagraphs = %q", got)
	}
}

func TestDaysAgoUsesWIB(t *testing.T) {
	// 2026-09-26 20:00 UTC is already 2026-09-27 03:00 WIB.
	now := time.Date(2026, 9, 26, 20, 0, 0, 0, time.UTC)
	got := daysAgo(now, 1, 8, 30)
	want := time.Date(2026, 9, 26, 8, 30, 0, 0, jakarta())
	if !got.Equal(want) {
		t.Fatalf("daysAgo = %v, want %v", got, want)
	}
	if d := wibDate(now, 0); d.Format("2006-01-02") != "2026-09-27" {
		t.Fatalf("wibDate = %v", d)
	}
}

func TestArticleDataValid(t *testing.T) {
	if len(demoArticles) != 21 {
		t.Fatalf("want 21 demo articles, got %d", len(demoArticles))
	}
	seen := map[string]bool{}
	for _, a := range demoArticles {
		if !slugRe.MatchString(a.Slug) || len(a.Slug) > maxSlugLen {
			t.Errorf("bad slug %q", a.Slug)
		}
		if seen[a.Slug] {
			t.Errorf("duplicate slug %q", a.Slug)
		}
		seen[a.Slug] = true
		if n := len([]rune(a.Title)); n < 1 || n > 200 {
			t.Errorf("%s: title length %d", a.Slug, n)
		}
		if n := len([]rune(a.Excerpt)); n == 0 || n > 300 {
			t.Errorf("%s: excerpt length %d", a.Slug, n)
		}
		if n := len(a.Paragraphs); n < 4 || n > 6 {
			t.Errorf("%s: %d paragraphs, want 4-6", a.Slug, n)
		}
		if a.Category == "" || a.Author == "" || a.DaysAgo < 0 {
			t.Errorf("%s: incomplete metadata", a.Slug)
		}
	}
	for _, list := range [][]string{slugsOf(demoAuthors), tagSlugs(), eventSlugs(), alumniSlugs(), videoSlugs()} {
		for _, s := range list {
			if !slugRe.MatchString(s) {
				t.Errorf("bad slug %q", s)
			}
		}
	}
	for _, v := range demoVideos {
		if !regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`).MatchString(v.YouTubeID) {
			t.Errorf("bad youtube id %q", v.YouTubeID)
		}
	}
}

func slugsOf(a []demoAuthor) (out []string) {
	for _, x := range a {
		out = append(out, x.Slug)
	}
	return
}
func tagSlugs() (out []string) {
	for _, x := range demoTags {
		out = append(out, x.Slug)
	}
	return
}
func eventSlugs() (out []string) {
	for _, x := range demoEvents {
		out = append(out, x.Slug)
	}
	return
}
func alumniSlugs() (out []string) {
	for _, x := range demoAlumni {
		out = append(out, x.Slug)
	}
	return
}
func videoSlugs() (out []string) {
	for _, x := range demoVideos {
		out = append(out, x.Slug)
	}
	return
}
