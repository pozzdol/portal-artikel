package jobs

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type syncBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuf) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}

func (s *syncBuf) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

func start(t *testing.T, r *Runner) (cancel func()) {
	t.Helper()
	ctx, stop := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { r.Run(ctx); close(done) }()
	var once sync.Once
	cancel = func() {
		once.Do(func() {
			stop()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("Run did not return after cancel")
			}
		})
	}
	t.Cleanup(cancel)
	return cancel
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met in time")
		}
		time.Sleep(time.Millisecond)
	}
}

func TestRunnerTicksAndStops(t *testing.T) {
	var n atomic.Int32
	r := NewRunner(nil, Job{Name: "tick", Every: 5 * time.Millisecond, Fn: func(context.Context) error {
		n.Add(1)
		return nil
	}})
	cancel := start(t, r)
	waitFor(t, func() bool { return n.Load() >= 3 })
	cancel()
	after := n.Load()
	time.Sleep(20 * time.Millisecond)
	if n.Load() != after {
		t.Fatalf("job ran after Run returned")
	}
}

func TestRunAtStart(t *testing.T) {
	var at, notAt atomic.Int32
	r := NewRunner(nil,
		Job{Name: "at", Every: time.Hour, RunAtStart: true, Fn: func(context.Context) error { at.Add(1); return nil }},
		Job{Name: "notat", Every: time.Hour, Fn: func(context.Context) error { notAt.Add(1); return nil }},
	)
	cancel := start(t, r)
	waitFor(t, func() bool { return at.Load() == 1 })
	cancel()
	if notAt.Load() != 0 {
		t.Fatalf("job without RunAtStart ran")
	}
}

func TestPanicAndErrorDoNotKillRunner(t *testing.T) {
	buf := &syncBuf{}
	log := slog.New(slog.NewTextHandler(buf, nil))
	var p, e atomic.Int32
	r := NewRunner(log,
		Job{Name: "panicky", Every: 5 * time.Millisecond, Fn: func(context.Context) error {
			p.Add(1)
			panic("boom")
		}},
		Job{Name: "erring", Every: 5 * time.Millisecond, Fn: func(context.Context) error {
			e.Add(1)
			return errors.New("nope")
		}},
	)
	cancel := start(t, r)
	waitFor(t, func() bool { return p.Load() >= 3 && e.Load() >= 3 })
	cancel()
	out := buf.String()
	if !strings.Contains(out, "panic: boom") || !strings.Contains(out, "nope") {
		t.Fatalf("expected logged failures, got:\n%s", out)
	}
}

func TestRunWaitsForInFlightAndCancelsIt(t *testing.T) {
	started := make(chan struct{})
	var finished atomic.Bool
	r := NewRunner(nil, Job{Name: "slow", Every: time.Hour, RunAtStart: true, Fn: func(ctx context.Context) error {
		close(started)
		<-ctx.Done()
		time.Sleep(10 * time.Millisecond)
		finished.Store(true)
		return ctx.Err()
	}})
	cancel := start(t, r)
	<-started
	cancel()
	if !finished.Load() {
		t.Fatal("Run returned before in-flight job finished")
	}
}

func TestJobTimeout(t *testing.T) {
	got := make(chan error, 1)
	r := NewRunner(nil, Job{Name: "t", Every: time.Hour, RunAtStart: true, Timeout: 10 * time.Millisecond,
		Fn: func(ctx context.Context) error {
			<-ctx.Done()
			got <- ctx.Err()
			return ctx.Err()
		}})
	start(t, r)
	select {
	case err := <-got:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("err = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout not applied")
	}
}

func TestInvalidJobsSkipped(t *testing.T) {
	r := NewRunner(nil, Job{Name: "nofn", Every: time.Millisecond}, Job{Name: "noevery", Fn: func(context.Context) error { return nil }})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	go func() { r.Run(ctx); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Run with only invalid jobs did not return")
	}
}
