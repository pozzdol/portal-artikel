package slugutil

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestMake(t *testing.T) {
	cases := map[string]string{
		"Menjaga Keikhlasan di Tengah Derasnya Arus Informasi": "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi",
		"Qur'an":                 "quran",
		"Al-Qur’an dan Ḥadīṡ":    "al-quran-dan-hadi",
		"Café Déjà Vu":           "cafe-deja-vu",
		"  Syarat & Ketentuan  ": "syarat-ketentuan",
		"Dr. H. Asep Suryana":    "dr-h-asep-suryana",
		"Reuni 2026!!!":          "reuni-2026",
		"Straße Œuvre":           "strasse-oeuvre",
		"---":                    "",
		"":                       "",
	}
	for in, want := range cases {
		if got := Make(in); got != want {
			t.Errorf("Make(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMakeMaxLen(t *testing.T) {
	s := Make(strings.Repeat("kata panjang ", 40))
	if len(s) > MaxLen || !Valid(s) {
		t.Fatalf("Make long = %q (len %d)", s, len(s))
	}
}

func TestValid(t *testing.T) {
	for _, s := range []string{"a", "abc-123", "kajian"} {
		if !Valid(s) {
			t.Errorf("Valid(%q) = false", s)
		}
	}
	for _, s := range []string{"", "-a", "a-", "a--b", "A", "a_b", "a b", strings.Repeat("a", MaxLen+1)} {
		if Valid(s) {
			t.Errorf("Valid(%q) = true", s)
		}
	}
}

// TestReservedMatchesMigration keeps Reserved in sync with the CHECK
// constraint categories_slug_not_reserved.
func TestReservedMatchesMigration(t *testing.T) {
	raw, err := os.ReadFile("../../db/migrations/00004_taxonomy.sql")
	if err != nil {
		t.Fatal(err)
	}
	block := regexp.MustCompile(`(?s)slug NOT IN \((.*?)\)\)`).FindSubmatch(raw)
	if block == nil {
		t.Fatal("reserved list not found in migration")
	}
	var fromSQL []string
	for _, m := range regexp.MustCompile(`'([^']+)'`).FindAllSubmatch(block[1], -1) {
		fromSQL = append(fromSQL, string(m[1]))
	}
	got := append([]string(nil), Reserved...)
	sort.Strings(got)
	sort.Strings(fromSQL)
	if strings.Join(got, ",") != strings.Join(fromSQL, ",") {
		t.Fatalf("Reserved = %v, migration = %v", got, fromSQL)
	}
	if !IsReserved("agenda") || IsReserved("kajian") {
		t.Fatal("IsReserved mismatch")
	}
}
