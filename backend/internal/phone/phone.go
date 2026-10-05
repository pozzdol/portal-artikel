// Package phone normalizes and formats Indonesian mobile numbers.
//
// A normalized number is stored without the country code or trunk prefix:
// "0812-3456-789", "+62 812 3456 789" and "628123456789" all normalize to
// "8123456789". It always matches ^8[0-9]{8,11}$ (the DB CHECK users_phone_format).
package phone

import "strings"

const (
	minLen = 9  // "8" + 8 digits
	maxLen = 12 // "8" + 11 digits
)

// Normalize parses raw user input into the normalized form. It trims
// surrounding whitespace, drops spaces, '-', '.', '(' and ')', allows a single
// leading '+', strips exactly one prefix of "+62", "62" or "0", and requires the
// rest to match ^8[0-9]{8,11}$. ok is false for anything else.
func Normalize(raw string) (n string, ok bool) {
	s := strings.TrimSpace(raw)
	var b strings.Builder
	b.Grow(len(s))
	for i, r := range s {
		switch {
		case r == ' ' || r == '-' || r == '.' || r == '(' || r == ')' || r == '\t':
			continue
		case r == '+':
			if i != 0 {
				return "", false
			}
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			return "", false
		}
	}
	s = b.String()
	switch {
	case strings.HasPrefix(s, "+62"):
		s = s[3:]
	case strings.HasPrefix(s, "+"):
		return "", false // other country codes are not supported
	case strings.HasPrefix(s, "62"):
		s = s[2:]
	case strings.HasPrefix(s, "0"):
		s = s[1:]
	}
	if !valid(s) {
		return "", false
	}
	return s, true
}

// valid reports whether s is already in normalized form.
func valid(s string) bool {
	if len(s) < minLen || len(s) > maxLen || s[0] != '8' {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// Display formats a normalized number for humans, e.g. "8123456789" →
// "+62 812-3456-789" (groups of 3, 4 and the rest). Input that is not
// normalized is returned unchanged.
func Display(n string) string {
	if !valid(n) {
		return n
	}
	return "+62 " + n[:3] + "-" + n[3:7] + "-" + n[7:]
}

// E164 returns the E.164 form of a normalized number, e.g. "+628123456789".
// Input that is not normalized is returned unchanged.
func E164(n string) string {
	if !valid(n) {
		return n
	}
	return "+62" + n
}
