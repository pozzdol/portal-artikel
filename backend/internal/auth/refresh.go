package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

// tokenBytes is the entropy of refresh and CSRF tokens.
const tokenBytes = 32

func randomToken() (string, error) {
	b := make([]byte, tokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("auth: random token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// NewRefreshToken returns a raw refresh token (43 base64url chars) and the
// sha256 hash that is stored in the database.
func NewRefreshToken() (raw string, hash []byte, err error) {
	raw, err = randomToken()
	if err != nil {
		return "", nil, err
	}
	return raw, HashRefreshToken(raw), nil
}

// HashRefreshToken returns sha256(raw).
func HashRefreshToken(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

// NewCSRFToken returns a random double-submit CSRF token.
func NewCSRFToken() (string, error) {
	return randomToken()
}
