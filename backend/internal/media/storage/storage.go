// Package storage stores uploaded files under a content-addressed-ish key
// (yyyy/mm/<random>.ext) and resolves them to public URLs.
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"time"
)

// Storage puts, deletes and resolves the URL of uploaded files. Implementations
// must be safe for concurrent use.
type Storage interface {
	// Put stores the contents of r under key, creating any missing directories.
	Put(ctx context.Context, key string, r io.Reader, contentType string) error
	// Delete removes the object at key. Deleting a missing key is not an error.
	Delete(ctx context.Context, key string) error
	// URL returns the public URL for key.
	URL(key string) string
}

// NewKey builds a storage key "yyyy/mm/<uuid-v4 hex>.ext" from now (UTC) and
// ext (no leading dot, e.g. "png").
func NewKey(now time.Time, ext string) string {
	u := now.UTC()
	return fmt.Sprintf("%04d/%02d/%s.%s", u.Year(), u.Month(), randomHex(16), ext)
}

func randomHex(n int) string {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand.Read only fails when the OS RNG is broken; a
		// timestamp-based fallback keeps the key unique enough for that
		// exceedingly rare case instead of panicking.
		return hex.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	}
	return hex.EncodeToString(buf)
}
