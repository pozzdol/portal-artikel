package rbac

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/authctx"
)

type fakeLoader struct {
	mu    sync.Mutex
	users map[int64]Access
	err   error
	calls atomic.Int64
}

func (f *fakeLoader) Load(_ context.Context, id int64) (Access, error) {
	f.calls.Add(1)
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return Access{}, f.err
	}
	a, ok := f.users[id]
	if !ok {
		return Access{}, apperr.NotFound()
	}
	return a, nil
}

func (f *fakeLoader) set(id int64, a Access) {
	f.mu.Lock()
	f.users[id] = a
	f.mu.Unlock()
}

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *fakeClock) add(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func setup() (*fakeLoader, *fakeClock, *Checker) {
	l := &fakeLoader{users: map[int64]Access{
		1: {IsActive: true, CanLogin: true, PermVersion: 1, Perms: NewSet(PermArticlesRead, PermUsersManage)},
	}}
	clk := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	return l, clk, NewCheckerWithLoader(l, time.Minute, clk.now)
}

func pr(id int64, pv int32) authctx.Principal { return authctx.Principal{UserID: id, PermVersion: pv} }

func TestCheckerCacheHitMissTTL(t *testing.T) {
	l, clk, c := setup()
	ctx := context.Background()

	a, err := c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.True(t, a.Perms.Has(PermUsersManage))
	assert.EqualValues(t, 1, l.calls.Load())

	_, err = c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.EqualValues(t, 1, l.calls.Load(), "second call must hit cache")

	clk.add(59 * time.Second)
	_, err = c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.EqualValues(t, 1, l.calls.Load())

	clk.add(time.Second)
	_, err = c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.EqualValues(t, 2, l.calls.Load(), "TTL expiry must reload")
}

func TestCheckerPermVersion(t *testing.T) {
	l, _, c := setup()
	ctx := context.Background()
	_, err := c.Access(ctx, pr(1, 1))
	require.NoError(t, err)

	// DB bumped to pv 2; old token pv 1 still hits the (fresh) cache entry.
	l.set(1, Access{IsActive: true, CanLogin: true, PermVersion: 2, Perms: NewSet(PermArticlesRead)})
	_, err = c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.EqualValues(t, 1, l.calls.Load())

	// Token with pv 2 (post-refresh) mismatches the cache → reload → ok.
	a, err := c.Access(ctx, pr(1, 2))
	require.NoError(t, err)
	assert.EqualValues(t, 2, l.calls.Load())
	assert.False(t, a.Perms.Has(PermUsersManage))

	// Old token pv 1 now mismatches → reload → still mismatched → token_expired.
	_, err = c.Access(ctx, pr(1, 1))
	assert.ErrorIs(t, err, apperr.ErrTokenExpired)
	assert.EqualValues(t, 3, l.calls.Load())
}

func TestCheckerInactiveAndMissing(t *testing.T) {
	l, _, c := setup()
	ctx := context.Background()
	l.set(2, Access{IsActive: false, CanLogin: true, PermVersion: 1, Perms: NewSet(PermUsersManage)})
	l.set(3, Access{IsActive: true, CanLogin: false, PermVersion: 1})

	_, err := c.Access(ctx, pr(2, 1))
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)
	_, err = c.Access(ctx, pr(3, 1))
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)
	_, err = c.Access(ctx, pr(99, 1))
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)

	// Inactive with outdated pv reports unauthenticated, not token_expired.
	_, err = c.Access(ctx, pr(2, 5))
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)
}

func TestCheckerLoaderError(t *testing.T) {
	l, _, c := setup()
	boom := errors.New("db down")
	l.err = boom
	_, err := c.Access(context.Background(), pr(1, 1))
	assert.ErrorIs(t, err, boom)
}

func TestCheckerInvalidate(t *testing.T) {
	l, _, c := setup()
	ctx := context.Background()
	_, _ = c.Access(ctx, pr(1, 1))
	l.set(1, Access{IsActive: false, CanLogin: true, PermVersion: 1})

	_, err := c.Access(ctx, pr(1, 1))
	require.NoError(t, err, "still cached")

	c.Invalidate(1)
	_, err = c.Access(ctx, pr(1, 1))
	assert.ErrorIs(t, err, apperr.ErrUnauthenticated)
	assert.EqualValues(t, 2, l.calls.Load())

	l.set(1, Access{IsActive: true, CanLogin: true, PermVersion: 1, Perms: NewSet(PermAuditView)})
	c.InvalidateAll()
	a, err := c.Access(ctx, pr(1, 1))
	require.NoError(t, err)
	assert.True(t, a.Perms.Has(PermAuditView))
	assert.EqualValues(t, 3, l.calls.Load())
}

func TestCheckerConcurrent(t *testing.T) {
	l, clk, c := setup()
	ctx := context.Background()
	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				switch j % 50 {
				case 0:
					c.Invalidate(1)
				case 25:
					c.InvalidateAll()
				case 10:
					clk.add(time.Second)
				case 30:
					l.set(1, Access{IsActive: true, CanLogin: true, PermVersion: 1, Perms: NewSet(PermArticlesRead)})
				}
				_, err := c.Access(ctx, pr(1, 1))
				assert.NoError(t, err)
			}
		}(i)
	}
	wg.Wait()
}

func serve(t *testing.T, h http.Handler, p *authctx.Principal) (*httptest.ResponseRecorder, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if p != nil {
		req = req.WithContext(authctx.WithPrincipal(req.Context(), *p))
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code < 400 {
		return rec, ""
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return rec, body.Error.Code
}

func TestRequirePermission(t *testing.T) {
	l, _, c := setup()
	l.set(2, Access{IsActive: false, CanLogin: true, PermVersion: 1, Perms: NewSet(PermUsersManage)})
	var gotPerms Set
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPerms = PermissionsFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	})

	h := RequirePermission(c, PermRolesManage, PermUsersManage)(ok) // ANY-of
	p1 := pr(1, 1)
	rec, _ := serve(t, h, &p1)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.True(t, gotPerms.Has(PermArticlesRead))

	_, code := serve(t, h, nil)
	assert.Equal(t, "unauthenticated", code)

	p2 := pr(2, 1)
	rec, code = serve(t, h, &p2)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "unauthenticated", code)

	pStale := pr(1, 9)
	rec, code = serve(t, h, &pStale)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "token_expired", code)

	rec, code = serve(t, c.Guard()(PermAuditView)(ok), &p1)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "forbidden", code)

	assert.Panics(t, func() { RequirePermission(c) })
}
