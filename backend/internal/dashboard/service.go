// Package dashboard implements GET /admin/dashboard: a read-only summary
// built directly on dbgen (it deliberately does not import internal/analytics
// to avoid a cross-worker dependency; see fase3 plan §W6).
package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

const (
	dailySeriesDays     = 14
	topWeekWindowDays   = 7
	topWeekLimit        = 5
	upcomingEventsLimit = 3
	recentDraftsLimit   = 5
)

// Service builds the dashboard summary.
type Service struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

// NewService returns a dashboard Service.
func NewService(pool *pgxpool.Pool, now func() time.Time) *Service {
	return &Service{pool: pool, now: now}
}

// Get assembles the full summary in a handful of read-only queries (no tx
// needed).
func (s *Service) Get(ctx context.Context) (*Payload, error) {
	q := dbgen.New(s.pool)
	today := httpx.WIBDate(s.now())

	statusRows, err := q.CountArticlesByStatus(ctx)
	if err != nil {
		return nil, fmt.Errorf("dashboard: count articles by status: %w", err)
	}
	var counts ArticleCounts
	for _, r := range statusRows {
		switch r.Status {
		case content.StatusDraft:
			counts.Draft = r.Count
		case content.StatusScheduled:
			counts.Scheduled = r.Count
		case content.StatusPublished:
			counts.Published = r.Count
		case content.StatusArchived:
			counts.Archived = r.Count
		}
	}

	from7 := today.AddDate(0, 0, -(topWeekWindowDays - 1))
	views7, err := q.SumViewsBetween(ctx, dbgen.SumViewsBetweenParams{FromDay: from7, ToDay: today})
	if err != nil {
		return nil, fmt.Errorf("dashboard: sum views: %w", err)
	}

	from14 := today.AddDate(0, 0, -(dailySeriesDays - 1))
	dailyRows, err := q.ListDailyViewTotals(ctx, dbgen.ListDailyViewTotalsParams{FromDay: from14, ToDay: today})
	if err != nil {
		return nil, fmt.Errorf("dashboard: list daily views: %w", err)
	}
	daily := make([]DayViews, len(dailyRows))
	for i, r := range dailyRows {
		daily[i] = DayViews{Day: httpx.FormatDate(r.Day), Views: r.Views}
	}

	topRows, err := q.ListTopArticleViews(ctx, dbgen.ListTopArticleViewsParams{FromDay: from7, ToDay: today, Limit: topWeekLimit})
	if err != nil {
		return nil, fmt.Errorf("dashboard: list top views: %w", err)
	}
	ids := make([]int64, len(topRows))
	viewsByID := make(map[int64]int64, len(topRows))
	for i, r := range topRows {
		ids[i] = r.ArticleID
		viewsByID[r.ArticleID] = r.Views
	}
	articles, err := q.ListPublishedArticlesByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("dashboard: list top articles: %w", err)
	}
	hydrator := content.NewHydrator(s.pool)
	cards, err := hydrator.Cards(ctx, articles)
	if err != nil {
		return nil, err
	}
	cardByID := make(map[int64]content.ArticleCard, len(cards))
	for _, c := range cards {
		cardByID[c.ID] = c
	}
	topWeek := make([]TopArticle, 0, len(ids))
	for _, id := range ids {
		if c, ok := cardByID[id]; ok {
			topWeek = append(topWeek, TopArticle{ArticleCard: c, Views: viewsByID[id]})
		}
	}

	eventRows, err := q.ListUpcomingEvents(ctx, upcomingEventsLimit)
	if err != nil {
		return nil, fmt.Errorf("dashboard: list upcoming events: %w", err)
	}
	upcoming, err := hydrator.EventCards(ctx, eventRows)
	if err != nil {
		return nil, err
	}

	draftRows, err := q.ListRecentDrafts(ctx, recentDraftsLimit)
	if err != nil {
		return nil, fmt.Errorf("dashboard: list recent drafts: %w", err)
	}
	drafts := make([]RecentDraft, len(draftRows))
	for i, a := range draftRows {
		drafts[i] = RecentDraft{ID: a.ID, Title: a.Title, Status: a.Status, UpdatedAt: httpx.FormatTime(a.UpdatedAt)}
	}

	return &Payload{
		Articles: counts, Views7d: views7, ViewsDaily: daily, TopWeek: topWeek,
		UpcomingEvents: upcoming, RecentDrafts: drafts,
	}, nil
}
