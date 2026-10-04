// Package content holds the shared read models (cards, media, refs) used by
// every public-facing domain, plus the hydrator that turns dbgen rows into
// cards with batched lookups.
package content

import "time"

// Article statuses (articles.status CHECK constraint).
const (
	StatusDraft     = "draft"
	StatusScheduled = "scheduled"
	StatusPublished = "published"
	StatusArchived  = "archived"
)

// IsPublic reports whether an article with the given status and published_at
// is publicly visible at now (published and published_at <= now). It mirrors
// the SQL predicate used by ListPublished*/GetPublished* queries; the
// deleted_at check stays in SQL.
func IsPublic(status string, publishedAt *time.Time, now time.Time) bool {
	return status == StatusPublished && publishedAt != nil && !publishedAt.After(now)
}
