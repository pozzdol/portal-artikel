package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndVerifyRoundTrip(t *testing.T) {
	h, err := HashPassword("rahasia-sangat-kuat")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$m=65536,t=3,p=2$") {
		t.Fatalf("unexpected PHC prefix: %q", h)
	}
	ok, err := VerifyPassword("rahasia-sangat-kuat", h)
	if err != nil || !ok {
		t.Fatalf("VerifyPassword(correct) = %v, %v; want true, nil", ok, err)
	}
}

func TestHashUsesRandomSalt(t *testing.T) {
	a, _ := HashPassword("sama")
	b, _ := HashPassword("sama")
	if a == b {
		t.Fatal("two hashes of the same password must differ (random salt)")
	}
}

func TestVerifyWrongPassword(t *testing.T) {
	h, err := HashPassword("benar-sekali-123")
	if err != nil {
		t.Fatal(err)
	}
	ok, err := VerifyPassword("salah-sekali-123", h)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("wrong password verified as correct")
	}
}

func TestVerifyMalformed(t *testing.T) {
	cases := []string{
		"",
		"plain",
		"$argon2i$v=19$m=65536,t=3,p=2$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=18$m=65536,t=3,p=2$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=x,t=3,p=2$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=0,t=3,p=2$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=65536,t=3,p=2$!!!$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=65536,t=3,p=2$c2FsdHNhbHRzYWx0$",
		"$argon2id$v=19$m=65536,t=3,p=2$c2FsdHNhbHRzYWx0",
	}
	for _, c := range cases {
		ok, err := VerifyPassword("x", c)
		if ok || !errors.Is(err, ErrInvalidHash) {
			t.Errorf("VerifyPassword(%q) = %v, %v; want false, ErrInvalidHash", c, ok, err)
		}
	}
}
