package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Local stores files on the local filesystem under dir and serves them at
// urlPrefix + "/" + key.
type Local struct {
	dir       string
	urlPrefix string
}

var _ Storage = (*Local)(nil)

// NewLocal returns a Local storage rooted at dir, serving files at
// urlPrefix (e.g. "/uploads").
func NewLocal(dir, urlPrefix string) *Local {
	return &Local{dir: dir, urlPrefix: strings.TrimSuffix(urlPrefix, "/")}
}

// Put writes r to dir/key, creating parent directories as needed. It writes
// to a temporary file first and renames it into place so a reader never sees
// a partially written file.
func (l *Local) Put(_ context.Context, key string, r io.Reader, _ string) error {
	path, err := l.resolve(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("storage: create directory: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".upload-*")
	if err != nil {
		return fmt.Errorf("storage: create temp file: %w", err)
	}
	tmpName := tmp.Name()
	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return fmt.Errorf("storage: write file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return fmt.Errorf("storage: close file: %w", err)
	}
	if err := os.Chmod(tmpName, 0o644); err != nil {
		os.Remove(tmpName)
		return fmt.Errorf("storage: chmod file: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return fmt.Errorf("storage: rename file: %w", err)
	}
	return nil
}

// Delete removes dir/key. A missing file is not an error.
func (l *Local) Delete(_ context.Context, key string) error {
	path, err := l.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("storage: delete file: %w", err)
	}
	return nil
}

// URL returns the public URL of key.
func (l *Local) URL(key string) string {
	return l.urlPrefix + "/" + key
}

// resolve validates key (no "..", no leading "/") and joins it to dir.
func (l *Local) resolve(key string) (string, error) {
	if key == "" || strings.HasPrefix(key, "/") || strings.Contains(key, "..") {
		return "", fmt.Errorf("storage: invalid key %q", key)
	}
	return filepath.Join(l.dir, filepath.FromSlash(key)), nil
}
