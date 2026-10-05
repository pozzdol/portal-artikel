package rbac

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/dbgen"
)

// Access is the authorization-relevant state of a user.
type Access struct {
	IsActive    bool
	CanLogin    bool
	PermVersion int32
	// MustChangePassword blocks every guarded route until the user changes
	// the initial password (self-service auth endpoints stay usable).
	MustChangePassword bool
	Perms              Set
}

// Loader loads a user's access state. It returns apperr.ErrNotFound when the
// user does not exist.
type Loader interface {
	Load(ctx context.Context, userID int64) (Access, error)
}

type dbLoader struct {
	q *dbgen.Queries
}

func (l dbLoader) Load(ctx context.Context, userID int64) (Access, error) {
	row, err := l.q.GetUserAccess(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Access{}, apperr.NotFound()
		}
		return Access{}, fmt.Errorf("rbac: load user access: %w", err)
	}
	codes, err := l.q.ListUserPermissionCodes(ctx, userID)
	if err != nil {
		return Access{}, fmt.Errorf("rbac: load user permissions: %w", err)
	}
	return Access{
		IsActive:           row.IsActive,
		CanLogin:           row.CanLogin,
		PermVersion:        row.PermVersion,
		MustChangePassword: row.MustChangePassword,
		Perms:              NewSet(codes...),
	}, nil
}

type cacheEntry struct {
	access   Access
	loadedAt time.Time
}

// Checker resolves and caches per-user permissions (TTL-bounded, invalidated
// on perm_version changes or explicit Invalidate calls). Safe for concurrent
// use.
type Checker struct {
	loader Loader
	ttl    time.Duration
	now    func() time.Time

	mu      sync.RWMutex
	entries map[int64]cacheEntry
	gen     uint64 // bumped on every invalidation; stale loads are not stored
}

var _ Invalidator = (*Checker)(nil)

// NewChecker returns a Checker backed by the database.
func NewChecker(pool *pgxpool.Pool, ttl time.Duration) *Checker {
	return NewCheckerWithLoader(dbLoader{q: dbgen.New(pool)}, ttl, nil)
}

// NewCheckerWithLoader returns a Checker using l. now defaults to
// time.Now().UTC() when nil.
func NewCheckerWithLoader(l Loader, ttl time.Duration, now func() time.Time) *Checker {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return &Checker{loader: l, ttl: ttl, now: now, entries: make(map[int64]cacheEntry)}
}

// Access returns the current access state for p, reloading it when the cache
// entry is missing, older than the TTL, or has a different perm version than
// the token. It returns apperr.ErrUnauthenticated when the user is missing,
// inactive or cannot log in, apperr.ErrTokenExpired when the token's perm
// version is outdated (the client must refresh), and
// apperr.ErrPasswordChangeRequired when the user must change the initial
// password first (checked last, so a stale token still gets token_expired).
func (c *Checker) Access(ctx context.Context, p authctx.Principal) (Access, error) {
	now := c.now()
	c.mu.RLock()
	e, ok := c.entries[p.UserID]
	gen := c.gen
	c.mu.RUnlock()

	if !ok || now.Sub(e.loadedAt) >= c.ttl || e.access.PermVersion != p.PermVersion {
		a, err := c.loader.Load(ctx, p.UserID)
		if err != nil {
			if errors.Is(err, apperr.ErrNotFound) {
				c.Invalidate(p.UserID)
				return Access{}, apperr.Unauthenticated("")
			}
			return Access{}, err
		}
		if a.Perms == nil {
			a.Perms = Set{}
		}
		e = cacheEntry{access: a, loadedAt: now}
		c.mu.Lock()
		if c.gen == gen {
			c.entries[p.UserID] = e
		}
		c.mu.Unlock()
	}

	if !e.access.IsActive || !e.access.CanLogin {
		return Access{}, apperr.Unauthenticated("")
	}
	if e.access.PermVersion != p.PermVersion {
		return Access{}, apperr.TokenExpired()
	}
	if e.access.MustChangePassword {
		return Access{}, apperr.PasswordChangeRequired()
	}
	return e.access, nil
}

// Invalidate drops the cached entry of userID.
func (c *Checker) Invalidate(userID int64) {
	c.mu.Lock()
	delete(c.entries, userID)
	c.gen++
	c.mu.Unlock()
}

// InvalidateAll drops every cached entry.
func (c *Checker) InvalidateAll() {
	c.mu.Lock()
	c.entries = make(map[int64]cacheEntry)
	c.gen++
	c.mu.Unlock()
}

// Guard returns a Guard bound to c.
func (c *Checker) Guard() Guard {
	return func(codes ...string) func(http.Handler) http.Handler {
		return RequirePermission(c, codes...)
	}
}
