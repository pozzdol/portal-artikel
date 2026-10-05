package phone

import "testing"

func TestNormalizeValid(t *testing.T) {
	cases := map[string]string{
		"0812-3456-789":      "8123456789",
		"+62 812 3456 789":   "8123456789",
		"628123456789":       "8123456789",
		"8123456789":         "8123456789",
		"  (0812) 3456.789 ": "8123456789",
		"+62-812-3456-7890":  "81234567890",
		"0812345678":         "812345678",
		"0812345678901":      "812345678901",
		"+62812234567890":    "812234567890",
	}
	for in, want := range cases {
		got, ok := Normalize(in)
		if !ok || got != want {
			t.Errorf("Normalize(%q) = %q, %v; want %q, true", in, got, ok, want)
		}
	}
}

func TestNormalizeInvalid(t *testing.T) {
	for _, in := range []string{
		"",
		"   ",
		"0812abc3456",
		"0812-3456-789x",
		"+1 202 555 0143",
		"+44 7911 123456",
		"0723456789",     // landline-style, not starting with 8
		"6201234567890",  // after 62 starts with 0
		"00812345678",    // only one prefix is stripped
		"62628123456789", // only one prefix is stripped
		"08123456",       // 7 digits after 8: too short
		"81234567",       // too short
		"08123456789012", // too long
		"8123456789012",  // too long
		"0812+3456789",   // '+' not leading
		"++628123456789",
		"0812/3456/789",
	} {
		if got, ok := Normalize(in); ok {
			t.Errorf("Normalize(%q) = %q, true; want rejection", in, got)
		}
	}
}

func TestDisplayAndE164(t *testing.T) {
	if got := Display("8123456789"); got != "+62 812-3456-789" {
		t.Errorf("Display = %q", got)
	}
	if got := Display("81234567890"); got != "+62 812-3456-7890" {
		t.Errorf("Display = %q", got)
	}
	if got := Display("812345678"); got != "+62 812-3456-78" {
		t.Errorf("Display = %q", got)
	}
	if got := E164("8123456789"); got != "+628123456789" {
		t.Errorf("E164 = %q", got)
	}
	if got := Display("abc"); got != "abc" {
		t.Errorf("Display(invalid) = %q", got)
	}
	if got := E164("0821"); got != "0821" {
		t.Errorf("E164(invalid) = %q", got)
	}
}
