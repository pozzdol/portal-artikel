package dashboard

import "portal-berita/backend/internal/content"

// ArticleCounts is the article count per status (deleted_at IS NULL only).
type ArticleCounts struct {
	Draft     int64 `json:"draft"`
	Scheduled int64 `json:"scheduled"`
	Published int64 `json:"published"`
	Archived  int64 `json:"archived"`
}

// DayViews is one day of the views_daily series.
type DayViews struct {
	Day   string `json:"day"`
	Views int64  `json:"views"`
}

// TopArticle is an ArticleCard plus its view count over the ranking window.
type TopArticle struct {
	content.ArticleCard
	Views int64 `json:"views"`
}

// RecentDraft is one row of recent_drafts (a compact projection, not a full card).
type RecentDraft struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updated_at"`
}

// Payload is the GET /admin/dashboard response body.
type Payload struct {
	Articles       ArticleCounts       `json:"articles"`
	Views7d        int64               `json:"views_7d"`
	ViewsDaily     []DayViews          `json:"views_daily"`
	TopWeek        []TopArticle        `json:"top_week"`
	UpcomingEvents []content.EventCard `json:"upcoming_events"`
	RecentDrafts   []RecentDraft       `json:"recent_drafts"`
}
