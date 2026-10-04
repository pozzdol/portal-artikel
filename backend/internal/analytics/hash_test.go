package analytics

import (
	"bytes"
	"crypto/sha256"
	"net/http/httptest"
	"testing"
	"time"
)

func TestVisitorHash(t *testing.T) {
	day := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	h := visitorHash("203.0.113.7", "Mozilla/5.0", day, "salt")
	want := sha256.Sum256([]byte("203.0.113.7|Mozilla/5.0|2026-09-27|salt"))
	if !bytes.Equal(h, want[:]) {
		t.Fatalf("hash mismatch")
	}
	if len(h) != 32 {
		t.Fatalf("len = %d", len(h))
	}
	if bytes.Contains(h, []byte("203.0.113.7")) {
		t.Fatal("raw ip leaked into hash")
	}
	variants := [][]byte{
		visitorHash("203.0.113.8", "Mozilla/5.0", day, "salt"),
		visitorHash("203.0.113.7", "Mozilla/5.1", day, "salt"),
		visitorHash("203.0.113.7", "Mozilla/5.0", day.AddDate(0, 0, 1), "salt"),
		visitorHash("203.0.113.7", "Mozilla/5.0", day, "other"),
	}
	for i, v := range variants {
		if bytes.Equal(h, v) {
			t.Errorf("variant %d collides", i)
		}
	}
}

func TestClientIP(t *testing.T) {
	for remote, want := range map[string]string{
		"203.0.113.7:5123": "203.0.113.7",
		"203.0.113.7":      "203.0.113.7",
		"[2001:db8::1]:80": "2001:db8::1",
		"2001:db8::1":      "2001:db8::1",
	} {
		r := httptest.NewRequest("POST", "/", nil)
		r.RemoteAddr = remote
		if got := clientIP(r); got != want {
			t.Errorf("clientIP(%q) = %q, want %q", remote, got, want)
		}
	}
}
