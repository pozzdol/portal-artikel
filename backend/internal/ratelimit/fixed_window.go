// Package ratelimit provides a small in-memory fixed-window rate limiter for
// public endpoints (e.g. the article view beacon). It is a copy of the auth
// login limiter so public packages never import internal/auth.
package ratelimit

import (
	"sync"
	"time"
)

// FixedWindow allows up to limit hits per key per window. Safe for concurrent use.
type FixedWindow struct {
	mu        sync.Mutex
	limit     int
	window    time.Duration
	buckets   map[string]*bucket
	lastSweep time.Time
	now       func() time.Time
}

type bucket struct {
	count int
	start time.Time
}

// New returns a limiter allowing limit hits per key per window.
func New(limit int, window time.Duration) *FixedWindow {
	return &FixedWindow{
		limit:   limit,
		window:  window,
		buckets: make(map[string]*bucket),
		now:     time.Now,
	}
}

// WithClock replaces the time source (tests) and returns l.
func (l *FixedWindow) WithClock(now func() time.Time) *FixedWindow {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.now = now
	return l
}

// Allow records a hit for key. When the limit is exceeded it returns false
// and the time until the key's window resets.
func (l *FixedWindow) Allow(key string) (ok bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweep(now)
	b, found := l.buckets[key]
	if !found || now.Sub(b.start) >= l.window {
		l.buckets[key] = &bucket{count: 1, start: now}
		return true, 0
	}
	if b.count >= l.limit {
		return false, b.start.Add(l.window).Sub(now)
	}
	b.count++
	return true, 0
}

// Reset forgets key.
func (l *FixedWindow) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.buckets, key)
}

// sweep drops expired buckets at most once per window. Caller holds mu.
func (l *FixedWindow) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < l.window {
		return
	}
	l.lastSweep = now
	for k, b := range l.buckets {
		if now.Sub(b.start) >= l.window {
			delete(l.buckets, k)
		}
	}
}
