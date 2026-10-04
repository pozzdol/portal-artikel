package auth

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// accessClaims is the JWT payload of an access token.
type accessClaims struct {
	jwt.RegisteredClaims
	SessionID   string `json:"sid"`
	PermVersion int32  `json:"pv"`
}

// TokenIssuer signs and verifies HS256 access tokens.
type TokenIssuer struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

var _ TokenVerifier = (*TokenIssuer)(nil)

// NewTokenIssuer returns an issuer signing with secret; tokens live for ttl.
func NewTokenIssuer(secret []byte, ttl time.Duration) *TokenIssuer {
	return &TokenIssuer{
		secret: append([]byte(nil), secret...),
		ttl:    ttl,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

// WithClock replaces the time source (tests).
func (i *TokenIssuer) WithClock(now func() time.Time) *TokenIssuer {
	i.now = now
	return i
}

// Issue signs an access token for p.
func (i *TokenIssuer) Issue(p Principal) (string, time.Time, error) {
	if p.UserID <= 0 || p.FamilyID == "" {
		return "", time.Time{}, errors.New("auth: issue: incomplete principal")
	}
	now := i.now()
	exp := now.Add(i.ttl)
	claims := accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Subject:   strconv.FormatInt(p.UserID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
		SessionID:   p.FamilyID,
		PermVersion: p.PermVersion,
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(i.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("auth: sign access token: %w", err)
	}
	return signed, exp, nil
}

// Verify parses and validates an access token. It returns ErrTokenExpired for
// an expired but otherwise valid token and ErrTokenInvalid for anything else.
func (i *TokenIssuer) Verify(token string) (Principal, error) {
	var claims accessClaims
	_, err := jwt.ParseWithClaims(token, &claims,
		func(*jwt.Token) (any, error) { return i.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(Issuer),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithTimeFunc(i.now),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return Principal{}, ErrTokenExpired
		}
		return Principal{}, ErrTokenInvalid
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 || claims.SessionID == "" {
		return Principal{}, ErrTokenInvalid
	}
	return Principal{UserID: id, FamilyID: claims.SessionID, PermVersion: claims.PermVersion}, nil
}
