package revalidate

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeNext struct {
	t       *testing.T
	mu      sync.Mutex
	bodies  [][]string
	secrets []string
	calls   atomic.Int32
	status  func(call int32) int
	got     chan []string
}

func newFakeNext(t *testing.T, status func(call int32) int) (*fakeNext, *httptest.Server) {
	t.Helper()
	f := &fakeNext{t: t, status: status, got: make(chan []string, 64)}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := f.calls.Add(1)
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("content-type = %q", ct)
		}
		var p payload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			t.Errorf("decode body: %v", err)
		}
		f.mu.Lock()
		f.bodies = append(f.bodies, p.Tags)
		f.secrets = append(f.secrets, r.Header.Get("X-Revalidate-Secret"))
		f.mu.Unlock()
		code := http.StatusOK
		if f.status != nil {
			code = f.status(n)
		}
		w.WriteHeader(code)
		if code == http.StatusOK {
			f.got <- p.Tags
		}
	}))
	t.Cleanup(srv.Close)
	return f, srv
}

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

func testLogger() (*slog.Logger, *syncBuf) {
	buf := &syncBuf{}
	return slog.New(slog.NewTextHandler(buf, &slog.HandlerOptions{Level: slog.LevelDebug})), buf
}

var fastBackoff = WithBackoff([]time.Duration{time.Millisecond, time.Millisecond, time.Millisecond})

func runWorker(t *testing.T, w *Worker) (cancel func()) {
	t.Helper()
	ctx, stop := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { w.Run(ctx); close(done) }()
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

func waitTags(t *testing.T, f *fakeNext) []string {
	t.Helper()
	select {
	case tags := <-f.got:
		return tags
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for POST")
		return nil
	}
}

func TestFlushSendsSortedUniqueWithSecret(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "s3cret", nil)
	w.Enqueue(TagHomepage, Article("b"), "", Article("a"))
	w.Enqueue(TagHomepage, TagSitemap)
	if err := w.Flush(context.Background()); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	want := []string{"article:a", "article:b", "homepage", "sitemap"}
	if got := waitTags(t, f); !reflect.DeepEqual(got, want) {
		t.Fatalf("tags = %v, want %v", got, want)
	}
	if f.secrets[0] != "s3cret" {
		t.Fatalf("secret header = %q", f.secrets[0])
	}
	// Nothing pending: no request.
	if err := w.Flush(context.Background()); err != nil {
		t.Fatal(err)
	}
	if n := f.calls.Load(); n != 1 {
		t.Fatalf("calls = %d, want 1", n)
	}
}

func TestRunDebounceMergesEnqueues(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "x", nil, WithDebounce(50*time.Millisecond), WithMaxWait(time.Second))
	cancel := runWorker(t, w)
	w.Enqueue(Article("one"), TagHomepage)
	time.Sleep(10 * time.Millisecond)
	w.Enqueue(Article("two"), TagHomepage)
	got := waitTags(t, f)
	want := []string{"article:one", "article:two", "homepage"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tags = %v, want %v", got, want)
	}
	cancel()
	if n := f.calls.Load(); n != 1 {
		t.Fatalf("calls = %d, want 1; bodies %v", n, f.bodies)
	}
}

func TestRunMaxWaitBoundsDebounce(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "x", nil, WithDebounce(time.Hour), WithMaxWait(30*time.Millisecond))
	runWorker(t, w)
	w.Enqueue(TagMenus)
	if got := waitTags(t, f); !reflect.DeepEqual(got, []string{"menus"}) {
		t.Fatalf("tags = %v", got)
	}
}

func TestRunBatchSizeSendsImmediately(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "x", nil, WithDebounce(time.Hour), WithMaxWait(time.Hour), WithBatchSize(3))
	runWorker(t, w)
	w.Enqueue("a", "b", "c")
	if got := waitTags(t, f); !reflect.DeepEqual(got, []string{"a", "b", "c"}) {
		t.Fatalf("tags = %v", got)
	}
}

func TestRetryThenSuccess(t *testing.T) {
	f, srv := newFakeNext(t, func(n int32) int {
		if n == 1 {
			return http.StatusInternalServerError
		}
		return http.StatusOK
	})
	w := NewWorker(srv.URL, "x", nil, fastBackoff)
	w.Enqueue(TagSettings)
	if err := w.Flush(context.Background()); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	if n := f.calls.Load(); n != 2 {
		t.Fatalf("calls = %d, want 2", n)
	}
}

func TestGivesUpAfterRetriesAndLogs(t *testing.T) {
	f, srv := newFakeNext(t, func(int32) int { return http.StatusBadGateway })
	log, buf := testLogger()
	w := NewWorker(srv.URL, "x", log, fastBackoff, WithDebounce(time.Millisecond))
	cancel := runWorker(t, w)
	w.Enqueue(TagVideos)
	deadline := time.Now().Add(5 * time.Second)
	for !strings.Contains(buf.String(), "dropping tags") {
		if time.Now().After(deadline) {
			t.Fatalf("no give-up log; log:\n%s", buf.String())
		}
		time.Sleep(time.Millisecond)
	}
	cancel()
	if n := f.calls.Load(); n != 4 {
		t.Fatalf("calls = %d, want 4 (1 try + 3 retries)", n)
	}
}

func TestNoRetryOnClientError(t *testing.T) {
	f, srv := newFakeNext(t, func(int32) int { return http.StatusUnauthorized })
	w := NewWorker(srv.URL, "wrong", nil, fastBackoff)
	w.Enqueue(TagHomepage)
	if err := w.Flush(context.Background()); err == nil {
		t.Fatal("want error")
	}
	if n := f.calls.Load(); n != 1 {
		t.Fatalf("calls = %d, want 1", n)
	}
}

func TestRunFlushesPendingOnCancel(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "x", nil, WithDebounce(time.Hour), WithMaxWait(time.Hour))
	cancel := runWorker(t, w)
	w.Enqueue(Event("haul"), TagEvents)
	cancel() // returns only after Run returned
	select {
	case got := <-f.got:
		if !reflect.DeepEqual(got, []string{"event:haul", "events"}) {
			t.Fatalf("tags = %v", got)
		}
	default:
		t.Fatal("pending tags not flushed on shutdown")
	}
}

func TestShutdownFlushIsBounded(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { <-block }))
	t.Cleanup(func() { close(block); srv.Close() })
	w := NewWorker(srv.URL, "x", nil, WithDebounce(time.Hour), WithMaxWait(time.Hour),
		WithShutdownTimeout(30*time.Millisecond), fastBackoff)
	ctx, cancel := context.WithCancel(context.Background())
	w.Enqueue(TagHomepage)
	cancel()
	done := make(chan struct{})
	go func() { w.Run(ctx); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("Run did not honor shutdown timeout")
	}
}

func TestQueueFullDrops(t *testing.T) {
	log, buf := testLogger()
	w := NewWorker("http://127.0.0.1:0", "x", log, WithQueueSize(2), WithBatchSize(100))
	w.Enqueue("a", "b", "a", "c")
	if got := w.take(); !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("pending = %v", got)
	}
	if !strings.Contains(buf.String(), "queue full") {
		t.Fatalf("no drop warning; log: %s", buf.String())
	}
}

func TestConcurrentEnqueue(t *testing.T) {
	f, srv := newFakeNext(t, nil)
	w := NewWorker(srv.URL, "x", nil, WithDebounce(20*time.Millisecond))
	cancel := runWorker(t, w)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); w.Enqueue(TagHomepage, TagSearch) }()
	}
	wg.Wait()
	cancel()
	f.mu.Lock()
	defer f.mu.Unlock()
	var all []string
	for _, b := range f.bodies {
		all = append(all, b...)
	}
	if got := Unique(all); !reflect.DeepEqual(got, []string{"homepage", "search"}) {
		t.Fatalf("tags = %v", got)
	}
}

func TestRecorderAndNoop(t *testing.T) {
	var c Client = Noop{}
	c.Enqueue("x")
	r := &Recorder{}
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); r.Enqueue(TagHomepage, Tag("fiqih")) }()
	}
	wg.Wait()
	r.Enqueue()
	if len(r.Batches) != 10 {
		t.Fatalf("batches = %d", len(r.Batches))
	}
	if got := r.Tags(); !reflect.DeepEqual(got, []string{"homepage", "tag:fiqih"}) {
		t.Fatalf("tags = %v", got)
	}
	r.Reset()
	if got := r.Tags(); len(got) != 0 {
		t.Fatalf("after reset = %v", got)
	}
}

func TestTagHelpers(t *testing.T) {
	cases := map[string]string{
		Article("a"): "article:a", Category("c"): "category:c", Tag("t"): "tag:t",
		Author("u"): "author:u", Event("e"): "event:e", Alumni("al"): "alumni:al",
		Video("v"): "video:v", Page("p"): "page:p",
	}
	for got, want := range cases {
		if got != want {
			t.Errorf("got %q want %q", got, want)
		}
	}
	if got := Unique(nil); got == nil || len(got) != 0 {
		t.Fatalf("Unique(nil) = %#v", got)
	}
}
