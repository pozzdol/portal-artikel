package storage_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"portal-berita/backend/internal/media/storage"
)

func mustParse(t *testing.T, s string) time.Time {
	t.Helper()
	tm, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("parse time: %v", err)
	}
	return tm
}

func TestLocalPutURLDelete(t *testing.T) {
	dir := t.TempDir()
	l := storage.NewLocal(dir, "/uploads")

	if got := l.URL("2026/09/abc.png"); got != "/uploads/2026/09/abc.png" {
		t.Fatalf("URL = %q", got)
	}

	ctx := context.Background()
	key := "2026/09/abc.png"
	if err := l.Put(ctx, key, strings.NewReader("hello"), "image/png"); err != nil {
		t.Fatalf("Put: %v", err)
	}
	path := filepath.Join(dir, "2026", "09", "abc.png")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read written file: %v", err)
	}
	if string(data) != "hello" {
		t.Fatalf("content = %q", data)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm() != 0o644 {
		t.Fatalf("mode = %v, want 0644", info.Mode().Perm())
	}

	if err := l.Delete(ctx, key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("file still exists after delete")
	}

	// Deleting a missing file is not an error.
	if err := l.Delete(ctx, key); err != nil {
		t.Fatalf("Delete missing: %v", err)
	}
}

func TestLocalRejectsUnsafeKeys(t *testing.T) {
	dir := t.TempDir()
	l := storage.NewLocal(dir, "/uploads")
	ctx := context.Background()

	cases := []string{"../escape.png", "/absolute.png", "a/../../b.png", ""}
	for _, key := range cases {
		if err := l.Put(ctx, key, strings.NewReader("x"), "image/png"); err == nil {
			t.Errorf("Put(%q) accepted an unsafe key", key)
		}
		if err := l.Delete(ctx, key); err == nil {
			t.Errorf("Delete(%q) accepted an unsafe key", key)
		}
	}
}

func TestNewKeyFormat(t *testing.T) {
	now := mustParse(t, "2026-09-05T10:00:00Z")
	key := storage.NewKey(now, "png")
	if !strings.HasPrefix(key, "2026/09/") || !strings.HasSuffix(key, ".png") {
		t.Fatalf("NewKey = %q", key)
	}
	// Two calls never collide.
	if storage.NewKey(now, "png") == key {
		t.Fatalf("NewKey produced the same key twice")
	}
}
