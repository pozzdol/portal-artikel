package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testSecret = []byte("0123456789abcdef0123456789abcdef")

func fixedClock(t time.Time) func() time.Time { return func() time.Time { return t } }

func TestTokenRoundTrip(t *testing.T) {
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	iss := NewTokenIssuer(testSecret, 15*time.Minute).WithClock(fixedClock(now))
	p := Principal{UserID: 42, FamilyID: "0b6b3c1e-8f1e-4b51-9d3a-2f0e5d7c9a11", PermVersion: 7}
	tok, exp, err := iss.Issue(p)
	require.NoError(t, err)
	assert.Equal(t, now.Add(15*time.Minute), exp)
	got, err := iss.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, p, got)
}

func TestTokenExpired(t *testing.T) {
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	iss := NewTokenIssuer(testSecret, 15*time.Minute).WithClock(fixedClock(now))
	tok, _, err := iss.Issue(Principal{UserID: 1, FamilyID: "f", PermVersion: 1})
	require.NoError(t, err)

	iss.WithClock(fixedClock(now.Add(15*time.Minute + time.Second)))
	_, err = iss.Verify(tok)
	assert.ErrorIs(t, err, ErrTokenExpired)

	iss.WithClock(fixedClock(now.Add(14 * time.Minute)))
	_, err = iss.Verify(tok)
	assert.NoError(t, err)
}

func TestTokenIssuedInFutureRejected(t *testing.T) {
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	iss := NewTokenIssuer(testSecret, 15*time.Minute).WithClock(fixedClock(now))
	tok, _, err := iss.Issue(Principal{UserID: 1, FamilyID: "f"})
	require.NoError(t, err)
	iss.WithClock(fixedClock(now.Add(-time.Minute)))
	_, err = iss.Verify(tok)
	assert.ErrorIs(t, err, ErrTokenInvalid)
}

func TestTokenWrongSecret(t *testing.T) {
	a := NewTokenIssuer(testSecret, time.Minute)
	b := NewTokenIssuer([]byte("another-secret-another-secret-xx"), time.Minute)
	tok, _, err := a.Issue(Principal{UserID: 1, FamilyID: "f"})
	require.NoError(t, err)
	_, err = b.Verify(tok)
	assert.ErrorIs(t, err, ErrTokenInvalid)
}

func claimsFor(now time.Time) accessClaims {
	return accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Subject:   "1",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute)),
		},
		SessionID: "f",
	}
}

func TestTokenAlgNoneRejected(t *testing.T) {
	now := time.Now().UTC()
	iss := NewTokenIssuer(testSecret, time.Minute)
	tok, err := jwt.NewWithClaims(jwt.SigningMethodNone, claimsFor(now)).SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)
	_, err = iss.Verify(tok)
	assert.ErrorIs(t, err, ErrTokenInvalid)

	// HS512 with the right secret is still rejected (only HS256 accepted).
	tok, err = jwt.NewWithClaims(jwt.SigningMethodHS512, claimsFor(now)).SignedString(testSecret)
	require.NoError(t, err)
	_, err = iss.Verify(tok)
	assert.ErrorIs(t, err, ErrTokenInvalid)
}

func TestTokenWrongIssuerAndMissingClaims(t *testing.T) {
	now := time.Now().UTC()
	iss := NewTokenIssuer(testSecret, time.Minute)
	sign := func(c accessClaims) string {
		s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(testSecret)
		require.NoError(t, err)
		return s
	}
	c := claimsFor(now)
	c.Issuer = "someone-else"
	_, err := iss.Verify(sign(c))
	assert.ErrorIs(t, err, ErrTokenInvalid)

	c = claimsFor(now)
	c.ExpiresAt = nil
	_, err = iss.Verify(sign(c))
	assert.ErrorIs(t, err, ErrTokenInvalid)

	c = claimsFor(now)
	c.Subject = "abc"
	_, err = iss.Verify(sign(c))
	assert.ErrorIs(t, err, ErrTokenInvalid)

	c = claimsFor(now)
	c.SessionID = ""
	_, err = iss.Verify(sign(c))
	assert.ErrorIs(t, err, ErrTokenInvalid)

	_, err = iss.Verify("not.a.jwt")
	assert.ErrorIs(t, err, ErrTokenInvalid)
	_, err = iss.Verify(strings.Repeat("a", 10))
	assert.ErrorIs(t, err, ErrTokenInvalid)
}

func TestIssueRejectsIncompletePrincipal(t *testing.T) {
	iss := NewTokenIssuer(testSecret, time.Minute)
	_, _, err := iss.Issue(Principal{UserID: 0, FamilyID: "f"})
	assert.Error(t, err)
	_, _, err = iss.Issue(Principal{UserID: 1})
	assert.Error(t, err)
}
