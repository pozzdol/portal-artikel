package article

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// PreviewIssuer is the JWT "iss" of preview tokens. It differs from the
// access-token issuer ("almaidah"), so a preview token never authenticates a
// session and an access token is never accepted as a preview token, even
// though both are signed with JWT_SECRET.
const PreviewIssuer = "almaidah-preview"

// DefaultPreviewTTL is the lifetime of a preview token (docs/05 §4).
const DefaultPreviewTTL = 30 * time.Minute

// ErrPreviewInvalid is returned by Verify for any invalid, expired or
// foreign token.
var ErrPreviewInvalid = errors.New("article: invalid preview token")

// PreviewTokens issues and verifies HS256 preview tokens whose subject is
// the article id.
type PreviewTokens struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

// NewPreviewTokens returns a token issuer. ttl <= 0 uses DefaultPreviewTTL;
// a nil now uses time.Now.
func NewPreviewTokens(secret []byte, ttl time.Duration, now func() time.Time) *PreviewTokens {
	if ttl <= 0 {
		ttl = DefaultPreviewTTL
	}
	if now == nil {
		now = time.Now
	}
	return &PreviewTokens{secret: append([]byte(nil), secret...), ttl: ttl, now: now}
}

// Issue signs a preview token for articleID.
func (p *PreviewTokens) Issue(articleID int64) (token string, exp time.Time, err error) {
	if articleID <= 0 {
		return "", time.Time{}, errors.New("article: issue preview token: invalid id")
	}
	if len(p.secret) == 0 {
		return "", time.Time{}, errors.New("article: issue preview token: empty secret")
	}
	now := p.now().UTC().Truncate(time.Second)
	exp = now.Add(p.ttl)
	claims := jwt.RegisteredClaims{
		Issuer:    PreviewIssuer,
		Subject:   strconv.FormatInt(articleID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(exp),
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(p.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("article: sign preview token: %w", err)
	}
	return signed, exp, nil
}

// Verify validates token and returns the article id it grants access to.
// Any failure returns ErrPreviewInvalid.
func (p *PreviewTokens) Verify(token string) (articleID int64, err error) {
	if token == "" || len(p.secret) == 0 {
		return 0, ErrPreviewInvalid
	}
	var claims jwt.RegisteredClaims
	_, err = jwt.ParseWithClaims(token, &claims,
		func(*jwt.Token) (any, error) { return p.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(PreviewIssuer),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithTimeFunc(p.now),
	)
	if err != nil {
		return 0, ErrPreviewInvalid
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, ErrPreviewInvalid
	}
	return id, nil
}
