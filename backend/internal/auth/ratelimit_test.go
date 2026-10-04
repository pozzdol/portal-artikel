package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLoginLimiter(t *testing.T) {
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	l := NewLoginLimiter(5, time.Minute)
	l.now = func() time.Time { return now }

	for i := 0; i < 5; i++ {
		ok, _ := l.Allow("1.2.3.4|a@b.c")
		assert.True(t, ok, "attempt %d", i+1)
	}
	now = now.Add(20 * time.Second)
	ok, retry := l.Allow("1.2.3.4|a@b.c")
	assert.False(t, ok)
	assert.Equal(t, 40*time.Second, retry)

	// Other keys are independent.
	ok, _ = l.Allow("1.2.3.4|x@b.c")
	assert.True(t, ok)

	// Window reset.
	now = now.Add(40 * time.Second)
	ok, _ = l.Allow("1.2.3.4|a@b.c")
	assert.True(t, ok)
}

func TestLoginLimiterReset(t *testing.T) {
	l := NewLoginLimiter(2, time.Minute)
	assert.True(t, first(l.Allow("k")))
	assert.True(t, first(l.Allow("k")))
	assert.False(t, first(l.Allow("k")))
	l.Reset("k")
	assert.True(t, first(l.Allow("k")))
}

func TestLoginLimiterSweep(t *testing.T) {
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	l := NewLoginLimiter(5, time.Minute)
	l.now = func() time.Time { return now }
	l.Allow("a")
	l.Allow("b")
	now = now.Add(2 * time.Minute)
	l.Allow("c")
	assert.Len(t, l.buckets, 1)
}

func first(ok bool, _ time.Duration) bool { return ok }
