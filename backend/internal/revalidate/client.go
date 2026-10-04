// Package revalidate notifies the Next.js frontend which cache tags must be
// revalidated after a content mutation (docs/03-arsitektur.md §4.2).
//
// Services call Client.Enqueue only after their database transaction has
// committed. The production implementation is Worker, which debounces and
// deduplicates tags before POSTing them to NEXT_REVALIDATE_URL.
package revalidate

import (
	"sort"
	"sync"
)

// Client accepts cache tags to revalidate. Implementations must be safe for
// concurrent use and must never block the caller for long.
type Client interface {
	Enqueue(tags ...string)
}

var (
	_ Client = Noop{}
	_ Client = (*Recorder)(nil)
	_ Client = (*Worker)(nil)
)

// Noop discards every tag. Useful as a nil-safe default.
type Noop struct{}

// Enqueue does nothing.
func (Noop) Enqueue(...string) {}

// Recorder is a test fake that records every Enqueue call. It is safe for
// concurrent use; the zero value is ready to use.
type Recorder struct {
	mu      sync.Mutex
	Batches [][]string
}

// Enqueue appends a copy of tags as one batch. Calls without tags are ignored.
func (r *Recorder) Enqueue(tags ...string) {
	if len(tags) == 0 {
		return
	}
	cp := append([]string(nil), tags...)
	r.mu.Lock()
	r.Batches = append(r.Batches, cp)
	r.mu.Unlock()
}

// Tags returns all recorded tags flattened, sorted and deduplicated.
func (r *Recorder) Tags() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var all []string
	for _, b := range r.Batches {
		all = append(all, b...)
	}
	return Unique(all)
}

// Reset forgets all recorded batches.
func (r *Recorder) Reset() {
	r.mu.Lock()
	r.Batches = nil
	r.mu.Unlock()
}

// Unique returns tags sorted and deduplicated, with empty strings removed.
// It never returns nil.
func Unique(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}
