package article

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/auth"
)

var testSecret = []byte("0123456789abcdef0123456789abcdef-preview")

func TestPreviewTokenRoundTrip(t *testing.T) {
	now := time.Date(2026, 9, 27, 3, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	p := NewPreviewTokens(testSecret, 30*time.Minute, clock)

	tok, exp, err := p.Issue(42)
	require.NoError(t, err)
	assert.Equal(t, now.Add(30*time.Minute), exp)

	id, err := p.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, int64(42), id)

	// Expired after the TTL.
	now = now.Add(31 * time.Minute)
	_, err = p.Verify(tok)
	assert.ErrorIs(t, err, ErrPreviewInvalid)
}

func TestPreviewTokenRejectsForeignTokens(t *testing.T) {
	p := NewPreviewTokens(testSecret, 0, nil)
	tok, _, err := p.Issue(7)
	require.NoError(t, err)

	// Wrong secret.
	other := NewPreviewTokens([]byte("another-secret-another-secret-xx"), 0, nil)
	_, err = other.Verify(tok)
	assert.ErrorIs(t, err, ErrPreviewInvalid)

	// An access token signed with the same secret has issuer "almaidah" and
	// must not work as a preview token.
	issuer := auth.NewTokenIssuer(testSecret, 15*time.Minute)
	access, _, err := issuer.Issue(auth.Principal{UserID: 7, FamilyID: "fam", PermVersion: 1})
	require.NoError(t, err)
	_, err = p.Verify(access)
	assert.ErrorIs(t, err, ErrPreviewInvalid)

	// And vice versa: a preview token never authenticates a session.
	_, err = issuer.Verify(tok)
	assert.Error(t, err)

	// Garbage, empty, tampered and alg=none tokens.
	for _, bad := range []string{"", "abc", tok + "x"} {
		_, err = p.Verify(bad)
		assert.ErrorIs(t, err, ErrPreviewInvalid, bad)
	}
	none, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{
		Issuer: PreviewIssuer, Subject: "7",
		IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)
	_, err = p.Verify(none)
	assert.ErrorIs(t, err, ErrPreviewInvalid)

	// Non-numeric subject.
	badSub, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer: PreviewIssuer, Subject: "abc",
		IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(testSecret)
	require.NoError(t, err)
	_, err = p.Verify(badSub)
	assert.ErrorIs(t, err, ErrPreviewInvalid)

	_, _, err = p.Issue(0)
	assert.Error(t, err)
}
