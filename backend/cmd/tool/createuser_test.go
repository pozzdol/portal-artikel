package main

import (
	"strings"
	"testing"
)

func TestValidateInitialPassword(t *testing.T) {
	cases := []struct {
		name       string
		pw         string
		mustChange bool
		wantErr    bool
	}{
		{"8 digits without must-change", "12345678", false, true},
		{"8 digits with must-change", "12345678", true, false},
		{"7 digits with must-change", "1234567", true, true},
		{"10 chars without must-change", "abcdefghij", false, false},
		{"9 chars without must-change", "abcdefghi", false, true},
		{"10 multibyte runes", "éééééééééé", false, false},
		{"128 chars", strings.Repeat("a", 128), false, false},
		{"129 chars", strings.Repeat("a", 129), true, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := validateInitialPassword(c.pw, c.mustChange)
			if (err != nil) != c.wantErr {
				t.Fatalf("validateInitialPassword(%q, %v) err=%v, wantErr=%v", c.pw, c.mustChange, err, c.wantErr)
			}
		})
	}
}

func TestParseCreateUserFlagsValid(t *testing.T) {
	o, err := parseCreateUserFlags([]string{"--phone", "0812-3456-789", "--name", " Budi ", "--must-change", "--password-stdin"})
	if err != nil {
		t.Fatal(err)
	}
	if o.Phone != "8123456789" || o.Email != "" || o.Name != "Budi" || o.Role != "admin" || !o.MustChange || !o.PasswordStdin || o.Update {
		t.Fatalf("unexpected opts: %+v", o)
	}

	o, err = parseCreateUserFlags([]string{"--email", " Admin@Example.ID ", "--phone", "+62 812 3456 789", "--name", "A", "--role", "editor", "--password-env", "PW"})
	if err != nil {
		t.Fatal(err)
	}
	if o.Email != "admin@example.id" || o.Phone != "8123456789" || o.Role != "editor" || o.PasswordEnv != "PW" {
		t.Fatalf("unexpected opts: %+v", o)
	}

	// --update may omit --name (keeps the existing display name).
	if _, err := parseCreateUserFlags([]string{"--email", "a@b.id", "--update"}); err != nil {
		t.Fatalf("update without name: %v", err)
	}
}

func TestParseCreateUserFlagsErrors(t *testing.T) {
	cases := map[string][]string{
		"no identifier":         {"--name", "A"},
		"bad email":             {"--email", "nope", "--name", "A"},
		"bad phone":             {"--phone", "+1 555 1234567", "--name", "A"},
		"phone too short":       {"--phone", "0812345", "--name", "A"},
		"missing name":          {"--email", "a@b.id"},
		"both password sources": {"--email", "a@b.id", "--name", "A", "--password-env", "PW", "--password-stdin"},
		"positional password":   {"--email", "a@b.id", "--name", "A", "rahasia123"},
		"password flag":         {"--email", "a@b.id", "--name", "A", "--password", "rahasia123"},
		"empty role":            {"--email", "a@b.id", "--name", "A", "--role", " "},
		"name too long":         {"--email", "a@b.id", "--name", strings.Repeat("n", 121)},
	}
	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := parseCreateUserFlags(args); err == nil {
				t.Fatalf("expected error for %v", args)
			}
		})
	}
}

func TestReadCreateUserPassword(t *testing.T) {
	env := func(k string) string {
		if k == "PW" {
			return "dari-env-123"
		}
		return ""
	}
	pw, err := readCreateUserPassword(createUserOpts{PasswordEnv: "PW"}, nil, env)
	if err != nil || pw != "dari-env-123" {
		t.Fatalf("env: pw=%q err=%v", pw, err)
	}
	if _, err := readCreateUserPassword(createUserOpts{PasswordEnv: "MISSING"}, nil, env); err == nil {
		t.Fatal("expected error for empty env var")
	}

	pw, err = readCreateUserPassword(createUserOpts{PasswordStdin: true}, strings.NewReader("12345678\r\nignored\n"), env)
	if err != nil || pw != "12345678" {
		t.Fatalf("stdin: pw=%q err=%v", pw, err)
	}
	pw, err = readCreateUserPassword(createUserOpts{PasswordStdin: true}, strings.NewReader("tanpa-newline"), env)
	if err != nil || pw != "tanpa-newline" {
		t.Fatalf("stdin no newline: pw=%q err=%v", pw, err)
	}
	if _, err := readCreateUserPassword(createUserOpts{PasswordStdin: true}, strings.NewReader("\n"), env); err == nil {
		t.Fatal("expected error for empty stdin line")
	}
}
