// Package jobs runs periodic background jobs (scheduled publishing, snippet
// window transitions, cleanup) with panic isolation and graceful shutdown.
package jobs

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"
)

// DefaultTimeout bounds a single job execution when Job.Timeout is zero.
const DefaultTimeout = 55 * time.Second

// Job is one periodic task.
type Job struct {
	Name       string
	Every      time.Duration
	RunAtStart bool
	// Timeout bounds each execution; zero means DefaultTimeout.
	Timeout time.Duration
	Fn      func(ctx context.Context) error
}

// Runner executes Jobs on their own tickers.
type Runner struct {
	log  *slog.Logger
	jobs []Job
}

// NewRunner builds a Runner. A nil log discards output.
func NewRunner(log *slog.Logger, jobs ...Job) *Runner {
	if log == nil {
		log = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return &Runner{log: log.With("component", "jobs"), jobs: append([]Job(nil), jobs...)}
}

// Run starts one goroutine per job and blocks until ctx is done and every
// in-flight execution has returned. Executions of the same job never overlap
// (ticks that fire while a job is still running are skipped). Each execution
// gets a ctx derived from ctx with the job's timeout, so cancelling ctx also
// cancels in-flight work. Jobs with Every <= 0 or a nil Fn are skipped.
func (r *Runner) Run(ctx context.Context) {
	var wg sync.WaitGroup
	for _, j := range r.jobs {
		if j.Fn == nil || j.Every <= 0 {
			r.log.Warn("skipping invalid job", "job", j.Name, "every", j.Every)
			continue
		}
		wg.Add(1)
		go func(j Job) {
			defer wg.Done()
			r.loop(ctx, j)
		}(j)
	}
	wg.Wait()
}

func (r *Runner) loop(ctx context.Context, j Job) {
	if j.RunAtStart && ctx.Err() == nil {
		r.runOnce(ctx, j)
	}
	t := time.NewTicker(j.Every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if ctx.Err() != nil {
				return
			}
			r.runOnce(ctx, j)
		}
	}
}

func (r *Runner) runOnce(parent context.Context, j Job) {
	timeout := j.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	start := time.Now()
	err := safeCall(ctx, j.Fn)
	dur := time.Since(start)
	if err != nil {
		if parent.Err() != nil {
			r.log.Info("job interrupted by shutdown", "job", j.Name, "duration", dur, "err", err)
			return
		}
		r.log.Error("job failed", "job", j.Name, "duration", dur, "err", err)
		return
	}
	r.log.Debug("job done", "job", j.Name, "duration", dur)
}

func safeCall(ctx context.Context, fn func(context.Context) error) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("panic: %v\n%s", p, debug.Stack())
		}
	}()
	return fn(ctx)
}
