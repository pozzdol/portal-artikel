package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRefreshToken(t *testing.T) {
	raw, hash, err := NewRefreshToken()
	require.NoError(t, err)
	assert.Len(t, raw, 43)
	b, err := base64.RawURLEncoding.DecodeString(raw)
	require.NoError(t, err)
	assert.Len(t, b, 32)
	want := sha256.Sum256([]byte(raw))
	assert.Equal(t, want[:], hash)
	assert.Equal(t, hash, HashRefreshToken(raw))

	raw2, _, err := NewRefreshToken()
	require.NoError(t, err)
	assert.NotEqual(t, raw, raw2)
}

func TestNewCSRFToken(t *testing.T) {
	a, err := NewCSRFToken()
	require.NoError(t, err)
	b, err := NewCSRFToken()
	require.NoError(t, err)
	assert.Len(t, a, 43)
	assert.NotEqual(t, a, b)
}

func TestFallbackDummyHashIsWellFormed(t *testing.T) {
	ok, err := VerifyPassword("anything", fallbackDummyHash)
	require.NoError(t, err)
	assert.False(t, ok)
}
