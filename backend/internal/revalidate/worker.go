package revalidate

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// Defaults for Worker; see the With* options.
const (
	DefaultDebounce        = time.Second
	DefaultMaxWait         = 5 * time.Second
	DefaultQueueSize       = 1024
	DefaultBatchSize       = 100
	DefaultHTTPTimeout     = 5 * time.Second
	DefaultShutdownTimeout = 5 * time.Second
)

// DefaultBackoff is the wait before each retry (3 retries after the first try).
var DefaultBackoff = []time.Duration{500 * time.Millisecond, 2 * time.Second, 8 * time.Second}

// Option configures a Worker.
type Option func(*Worker)

// WithDebounce sets the quiet period after the last Enqueue before sending.
func WithDebounce(d time.Duration) Option { return func(w *Worker) { w.debounce = d } }

// WithMaxWait caps how long a pending tag may wait while Enqueue calls keep
// resetting the debounce timer.
func WithMaxWait(d time.Duration) Option { return func(w *Worker) { w.maxWait = d } }

// WithHTTPClient replaces the HTTP client (default: 5s timeout).
func WithHTTPClient(c *http.Client) Option { return func(w *Worker) { w.http = c } }

// WithBackoff sets the waits between attempts; len(b) is the number of retries.
func WithBackoff(b []time.Duration) Option {
	return func(w *Worker) { w.backoff = append([]time.Duration(nil), b...) }
}

// WithQueueSize sets the maximum number of distinct pending tags. Tags that
// arrive while the queue is full are dropped with a warning.
func WithQueueSize(n int) Option { return func(w *Worker) { w.queueSize = n } }

// WithBatchSize sets the number of pending tags that triggers an immediate send.
func WithBatchSize(n int) Option { return func(w *Worker) { w.batchSize = n } }

// WithShutdownTimeout bounds the final flush performed when Run's ctx ends.
func WithShutdownTimeout(d time.Duration) Option { return func(w *Worker) { w.shutdownTimeout = d } }

// Worker collects tags, debounces them and POSTs {"tags":[...]} to the
// Next.js revalidate endpoint with the X-Revalidate-Secret header.
//
// Enqueue never blocks on I/O. Run owns the send loop; Flush may also be
// called directly (tests, or when Run is not running).
type Worker struct {
	url    string
	secret string
	log    *slog.Logger
	http   *http.Client

	debounce        time.Duration
	maxWait         time.Duration
	backoff         []time.Duration
	queueSize       int
	batchSize       int
	shutdownTimeout time.Duration

	mu      sync.Mutex
	pending map[string]struct{}
	notify  chan struct{} // cap 1: "pending changed"
	full    chan struct{} // cap 1: "batch size reached"
}

// NewWorker builds a Worker. A nil log discards output.
func NewWorker(url, secret string, log *slog.Logger, opts ...Option) *Worker {
	if log == nil {
		log = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	w := &Worker{
		url:             url,
		secret:          secret,
		log:             log.With("component", "revalidate"),
		http:            &http.Client{Timeout: DefaultHTTPTimeout},
		debounce:        DefaultDebounce,
		maxWait:         DefaultMaxWait,
		backoff:         append([]time.Duration(nil), DefaultBackoff...),
		queueSize:       DefaultQueueSize,
		batchSize:       DefaultBatchSize,
		shutdownTimeout: DefaultShutdownTimeout,
		pending:         make(map[string]struct{}),
		notify:          make(chan struct{}, 1),
		full:            make(chan struct{}, 1),
	}
	for _, o := range opts {
		o(w)
	}
	return w
}

// Enqueue adds tags to the pending set. It is non-blocking and safe for
// concurrent use; empty tags are ignored.
func (w *Worker) Enqueue(tags ...string) {
	if len(tags) == 0 {
		return
	}
	var dropped []string
	w.mu.Lock()
	for _, t := range tags {
		if t == "" {
			continue
		}
		if _, ok := w.pending[t]; ok {
			continue
		}
		if len(w.pending) >= w.queueSize {
			dropped = append(dropped, t)
			continue
		}
		w.pending[t] = struct{}{}
	}
	reached := len(w.pending) >= w.batchSize
	w.mu.Unlock()

	signal(w.notify)
	if reached {
		signal(w.full)
	}
	if len(dropped) > 0 {
		w.log.Warn("revalidate queue full, dropping tags", "tags", dropped)
	}
}

func signal(ch chan struct{}) {
	select {
	case ch <- struct{}{}:
	default:
	}
}

// take removes and returns all pending tags, sorted.
func (w *Worker) take() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.pending) == 0 {
		return nil
	}
	tags := make([]string, 0, len(w.pending))
	for t := range w.pending {
		tags = append(tags, t)
	}
	w.pending = make(map[string]struct{})
	return Unique(tags)
}

// Run sends debounced batches until ctx is done, then flushes whatever is
// still pending and returns. Sends are not aborted the moment ctx ends: an
// in-flight send and the final flush share one deadline of
// WithShutdownTimeout (default 5s) measured from ctx cancellation, so Run
// always returns within that bound after ctx is done.
func (w *Worker) Run(ctx context.Context) {
	drainCtx, drainCancel := context.WithCancel(context.WithoutCancel(ctx))
	defer drainCancel()
	var drainTimer *time.Timer
	var drainMu sync.Mutex
	stopAfter := context.AfterFunc(ctx, func() {
		drainMu.Lock()
		drainTimer = time.AfterFunc(w.shutdownTimeout, drainCancel)
		drainMu.Unlock()
	})
	defer func() {
		stopAfter()
		drainMu.Lock()
		if drainTimer != nil {
			drainTimer.Stop()
		}
		drainMu.Unlock()
	}()

	debounce := time.NewTimer(time.Hour)
	stopTimer(debounce)
	defer debounce.Stop()
	var (
		armed    bool
		deadline <-chan time.Time
		maxTimer *time.Timer
	)
	disarm := func() {
		armed = false
		stopTimer(debounce)
		if maxTimer != nil {
			maxTimer.Stop()
			maxTimer = nil
		}
		deadline = nil
	}
	defer disarm()

	send := func() {
		disarm()
		if err := w.Flush(drainCtx); err != nil {
			w.log.Error("revalidate failed, dropping tags", "err", err)
		}
	}

	for {
		select {
		case <-ctx.Done():
			send()
			return
		case <-w.full:
			send()
		case <-w.notify:
			stopTimer(debounce)
			debounce.Reset(w.debounce)
			if !armed {
				armed = true
				maxTimer = time.NewTimer(w.maxWait)
				deadline = maxTimer.C
			}
		case <-debounce.C:
			send()
		case <-deadline:
			send()
		}
	}
}

// stopTimer stops t and drains its channel if it had already fired.
func stopTimer(t *time.Timer) {
	if !t.Stop() {
		select {
		case <-t.C:
		default:
		}
	}
}

// Flush sends all pending tags now (with retries) and reports the final error.
// Tags are dropped on failure.
func (w *Worker) Flush(ctx context.Context) error {
	tags := w.take()
	if len(tags) == 0 {
		return nil
	}
	if err := w.sendWithRetry(ctx, tags); err != nil {
		return fmt.Errorf("revalidate tags %v: %w", tags, err)
	}
	return nil
}

// errPermanent marks a response that retrying cannot fix (e.g. 401).
var errPermanent = errors.New("permanent failure")

func (w *Worker) sendWithRetry(ctx context.Context, tags []string) error {
	var err error
	for attempt := 0; ; attempt++ {
		err = w.send(ctx, tags)
		if err == nil {
			w.log.Debug("revalidated", "tags", tags, "attempt", attempt+1)
			return nil
		}
		if errors.Is(err, errPermanent) || attempt >= len(w.backoff) || ctx.Err() != nil {
			return err
		}
		w.log.Warn("revalidate attempt failed, retrying", "attempt", attempt+1, "err", err)
		t := time.NewTimer(w.backoff[attempt])
		select {
		case <-ctx.Done():
			t.Stop()
			return fmt.Errorf("%w (last error: %w)", ctx.Err(), err)
		case <-t.C:
		}
	}
}

type payload struct {
	Tags []string `json:"tags"`
}

func (w *Worker) send(ctx context.Context, tags []string) error {
	if w.url == "" {
		return fmt.Errorf("revalidate url not configured: %w", errPermanent)
	}
	body, err := json.Marshal(payload{Tags: tags})
	if err != nil {
		return fmt.Errorf("encode payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, w.url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w: %w", err, errPermanent)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Revalidate-Secret", w.secret)
	resp, err := w.http.Do(req)
	if err != nil {
		return fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	case resp.StatusCode == http.StatusRequestTimeout, resp.StatusCode == http.StatusTooManyRequests,
		resp.StatusCode >= 500:
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	default:
		return fmt.Errorf("unexpected status %d: %w", resp.StatusCode, errPermanent)
	}
}
