package ratelimit

import (
	"sync"
	"testing"
	"time"
)

func TestFixedWindow(t *testing.T) {
	now := time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)
	l := New(2, time.Minute).WithClock(func() time.Time { return now })

	for i := 0; i < 2; i++ {
		if ok, _ := l.Allow("ip"); !ok {
			t.Fatalf("hit %d rejected", i+1)
		}
	}
	ok, retry := l.Allow("ip")
	if ok || retry != time.Minute {
		t.Fatalf("3rd hit: ok=%v retry=%v", ok, retry)
	}
	if ok, _ := l.Allow("other"); !ok {
		t.Fatal("independent key rejected")
	}

	now = now.Add(30 * time.Second)
	if _, retry := l.Allow("ip"); retry != 30*time.Second {
		t.Fatalf("retry = %v", retry)
	}

	now = now.Add(30 * time.Second)
	if ok, _ := l.Allow("ip"); !ok {
		t.Fatal("new window rejected")
	}

	l.Allow("ip")
	l.Reset("ip")
	if ok, _ := l.Allow("ip"); !ok {
		t.Fatal("after reset rejected")
	}
}

func TestFixedWindowSweep(t *testing.T) {
	now := time.Now()
	l := New(1, time.Second).WithClock(func() time.Time { return now })
	l.Allow("a")
	l.Allow("b")
	now = now.Add(2 * time.Second)
	l.Allow("c")
	if n := len(l.buckets); n != 1 {
		t.Fatalf("buckets after sweep = %d, want 1", n)
	}
}

func TestFixedWindowConcurrent(t *testing.T) {
	l := New(50, time.Hour)
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ok, _ := l.Allow("k"); ok {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if allowed != 50 {
		t.Fatalf("allowed = %d, want 50", allowed)
	}
}
