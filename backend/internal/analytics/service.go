// Package analytics records article views (privacy-preserving dedup, no raw
// IPs stored) and serves the trending / popular widgets (docs/03 §4.5).
package analytics

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// Trending windows accepted by Service.Trending.
const (
	WindowDay  = "day"  // today + yesterday (WIB)
	WindowWeek = "week" // last 7 days incl. today (WIB)
)

// dedupRetentionDays: dedup rows with day < today-2 (WIB) are deleted.
const dedupRetentionDays = 2

// DayViews is one day of the dashboard views series.
type DayViews struct {
	Day   string `json:"day"` // "2006-01-02" (WIB calendar date)
	Views int64  `json:"views"`
}

// TopArticle is an article card with its summed views in a window.
type TopArticle struct {
	content.ArticleCard
	Views int64 `json:"views"`
}

// Service implements view recording and view-based rankings.
type Service struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
	hyd  *content.Hydrator
	salt string
	now  func() time.Time
}

// NewService builds a Service. salt is VIEW_HASH_SALT; a nil now uses time.Now.
func NewService(pool *pgxpool.Pool, salt string, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{pool: pool, q: dbgen.New(pool), hyd: content.NewHydrator(pool), salt: salt, now: now}
}

// today returns the current WIB calendar date as a DATE bind value.
func (s *Service) today() time.Time { return httpx.WIBDate(s.now()) }

// visitorHash = sha256(ip | ua | day | salt). The raw IP is never stored.
func visitorHash(ip, userAgent string, day time.Time, salt string) []byte {
	sum := sha256.Sum256([]byte(ip + "|" + userAgent + "|" + day.Format("2006-01-02") + "|" + salt))
	return sum[:]
}

// RecordView counts one unique view per visitor/article/WIB day. Bots,
// unknown and non-public articles are ignored and return (false, nil).
func (s *Service) RecordView(ctx context.Context, articleID int64, ip, userAgent string) (counted bool, err error) {
	if articleID <= 0 || IsBot(userAgent) {
		return false, nil
	}
	day := s.today()
	hash := visitorHash(ip, userAgent, day, s.salt)
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		n, err := q.InsertViewDedup(ctx, dbgen.InsertViewDedupParams{VisitorHash: hash, Day: day, ArticleID: articleID})
		if err != nil {
			return fmt.Errorf("insert view dedup: %w", err)
		}
		if n == 0 {
			return nil
		}
		if err := q.UpsertDailyView(ctx, dbgen.UpsertDailyViewParams{ArticleID: articleID, Day: day}); err != nil {
			return fmt.Errorf("upsert daily view: %w", err)
		}
		if err := q.IncrementArticleViewCount(ctx, articleID); err != nil {
			return fmt.Errorf("increment view count: %w", err)
		}
		counted = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return counted, nil
}

// Trending returns the most viewed published articles in window ("day" =
// today+yesterday, "week" = last 7 days; anything else is treated as "day"),
// topped up with the latest articles when fewer than limit have views.
func (s *Service) Trending(ctx context.Context, window string, limit int) ([]content.ArticleCard, error) {
	days := 2
	if window == WindowWeek {
		days = 7
	}
	return s.ranked(ctx, days, limit)
}

// Popular returns the most viewed published articles over the last days days
// (incl. today), with the same latest-articles fallback as Trending.
func (s *Service) Popular(ctx context.Context, days, limit int) ([]content.ArticleCard, error) {
	if days < 1 {
		days = 1
	}
	return s.ranked(ctx, days, limit)
}

func (s *Service) ranked(ctx context.Context, days, limit int) ([]content.ArticleCard, error) {
	if limit <= 0 {
		return []content.ArticleCard{}, nil
	}
	top, err := s.top(ctx, days, limit)
	if err != nil {
		return nil, err
	}
	ids := make([]int64, len(top))
	for i, t := range top {
		ids[i] = t.ArticleID
	}
	rows, err := s.articlesInOrder(ctx, ids)
	if err != nil {
		return nil, err
	}
	if len(rows) < limit {
		seen := make([]int64, len(rows))
		for i, a := range rows {
			seen[i] = a.ID
		}
		more, err := s.q.ListLatestPublishedExcluding(ctx, dbgen.ListLatestPublishedExcludingParams{
			ExcludeIds: seen, Limit: int32(limit - len(rows)),
		})
		if err != nil {
			return nil, fmt.Errorf("list latest: %w", err)
		}
		rows = append(rows, more...)
	}
	return s.hyd.Cards(ctx, rows)
}

// top returns (article_id, views) for the last days days (incl. today).
func (s *Service) top(ctx context.Context, days, limit int) ([]dbgen.ListTopArticleViewsRow, error) {
	today := s.today()
	rows, err := s.q.ListTopArticleViews(ctx, dbgen.ListTopArticleViewsParams{
		FromDay: today.AddDate(0, 0, -(days - 1)), ToDay: today, Limit: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("list top views: %w", err)
	}
	return rows, nil
}

// articlesInOrder loads published articles by id, preserving ids order and
// dropping ids that are not (or no longer) public.
func (s *Service) articlesInOrder(ctx context.Context, ids []int64) ([]dbgen.Article, error) {
	if len(ids) == 0 {
		return []dbgen.Article{}, nil
	}
	rows, err := s.q.ListPublishedArticlesByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list articles by ids: %w", err)
	}
	byID := make(map[int64]dbgen.Article, len(rows))
	for _, a := range rows {
		byID[a.ID] = a
	}
	out := make([]dbgen.Article, 0, len(ids))
	for _, id := range ids {
		if a, ok := byID[id]; ok {
			out = append(out, a)
		}
	}
	return out, nil
}

// TopThisWeek returns the most viewed articles of the last 7 days with their
// view sums (no latest fallback). Used by the admin dashboard.
func (s *Service) TopThisWeek(ctx context.Context, limit int) ([]TopArticle, error) {
	if limit <= 0 {
		return []TopArticle{}, nil
	}
	top, err := s.top(ctx, 7, limit)
	if err != nil {
		return nil, err
	}
	ids := make([]int64, len(top))
	views := make(map[int64]int64, len(top))
	for i, t := range top {
		ids[i] = t.ArticleID
		views[t.ArticleID] = t.Views
	}
	rows, err := s.articlesInOrder(ctx, ids)
	if err != nil {
		return nil, err
	}
	cards, err := s.hyd.Cards(ctx, rows)
	if err != nil {
		return nil, err
	}
	out := make([]TopArticle, len(cards))
	for i, c := range cards {
		out[i] = TopArticle{ArticleCard: c, Views: views[c.ID]}
	}
	return out, nil
}

// DashboardViews returns the total views and a zero-filled daily series for
// the last days days (incl. today, WIB).
func (s *Service) DashboardViews(ctx context.Context, days int) (total int64, series []DayViews, err error) {
	if days < 1 {
		days = 1
	}
	today := s.today()
	from := today.AddDate(0, 0, -(days - 1))
	rows, err := s.q.ListDailyViewTotals(ctx, dbgen.ListDailyViewTotalsParams{FromDay: from, ToDay: today})
	if err != nil {
		return 0, nil, fmt.Errorf("list daily views: %w", err)
	}
	series = make([]DayViews, len(rows))
	for i, r := range rows {
		series[i] = DayViews{Day: r.Day.Format("2006-01-02"), Views: r.Views}
		total += r.Views
	}
	return total, series, nil
}

// CleanupDedup deletes dedup rows older than two days (day < today-2 WIB)
// and returns the number of deleted rows.
func (s *Service) CleanupDedup(ctx context.Context) (int64, error) {
	n, err := s.q.DeleteOldViewDedup(ctx, s.today().AddDate(0, 0, -dedupRetentionDays))
	if err != nil {
		return 0, fmt.Errorf("delete old view dedup: %w", err)
	}
	return n, nil
}
