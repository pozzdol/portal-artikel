package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/auth"
)

type stubVerifier map[string]error

func (s stubVerifier) Verify(token string) (auth.Principal, error) {
	if err, ok := s[token]; ok {
		return auth.Principal{}, err
	}
	if token == "good" {
		return auth.Principal{UserID: 7, FamilyID: "fam", PermVersion: 3}, nil
	}
	return auth.Principal{}, auth.ErrTokenInvalid
}

func errCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body.Error.Code
}

func TestAuthenticate(t *testing.T) {
	v := stubVerifier{"expired": auth.ErrTokenExpired}
	var got auth.Principal
	var seen bool
	h := Authenticate(v)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, seen = auth.FromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	cases := []struct {
		name   string
		cookie string
		status int
		code   string
	}{
		{"no cookie", "", http.StatusUnauthorized, "unauthenticated"},
		{"invalid", "garbage", http.StatusUnauthorized, "unauthenticated"},
		{"expired", "expired", http.StatusUnauthorized, "token_expired"},
		{"ok", "good", http.StatusNoContent, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seen = false
			req := httptest.NewRequest(http.MethodGet, "/x", nil)
			if tc.cookie != "" {
				req.AddCookie(&http.Cookie{Name: auth.CookieAccess, Value: tc.cookie})
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			assert.Equal(t, tc.status, rec.Code)
			if tc.code != "" {
				assert.Equal(t, tc.code, errCode(t, rec))
				assert.False(t, seen)
				return
			}
			require.True(t, seen)
			assert.Equal(t, auth.Principal{UserID: 7, FamilyID: "fam", PermVersion: 3}, got)
		})
	}
}

func TestCSRF(t *testing.T) {
	h := CSRF(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	cases := []struct {
		name   string
		method string
		cookie string
		header string
		ok     bool
	}{
		{"get no token", http.MethodGet, "", "", true},
		{"head no token", http.MethodHead, "", "", true},
		{"options no token", http.MethodOptions, "", "", true},
		{"post match", http.MethodPost, "tok", "tok", true},
		{"put match", http.MethodPut, "tok", "tok", true},
		{"delete match", http.MethodDelete, "tok", "tok", true},
		{"patch match", http.MethodPatch, "tok", "tok", true},
		{"post missing both", http.MethodPost, "", "", false},
		{"post missing header", http.MethodPost, "tok", "", false},
		{"post missing cookie", http.MethodPost, "", "tok", false},
		{"post mismatch", http.MethodPost, "tok", "tok2", false},
		{"delete mismatch", http.MethodDelete, "abc", "abd", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/x", nil)
			if tc.cookie != "" {
				req.AddCookie(&http.Cookie{Name: auth.CookieCSRF, Value: tc.cookie})
			}
			if tc.header != "" {
				req.Header.Set(auth.HeaderCSRF, tc.header)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if tc.ok {
				assert.Equal(t, http.StatusNoContent, rec.Code)
				return
			}
			assert.Equal(t, http.StatusForbidden, rec.Code)
			assert.Equal(t, "csrf_failed", errCode(t, rec))
		})
	}
}
