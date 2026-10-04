// Package homepage implements the homepage section builder: the section type
// registry (validation, defaults, JSON Schema), the admin CRUD/reorder
// endpoints and the public resolver that returns every active section with
// its data (docs/06 §3, docs/05 §2.1).
package homepage

import (
	"encoding/json"

	"portal-berita/backend/internal/content"
)

// PageKeyHome is the only page key used in the MVP.
const PageKeyHome = "home"

// Section is the admin representation of a homepage_sections row. Config is
// the normalized config when valid (ConfigValid) or the stored JSON as-is.
type Section struct {
	ID          int64           `json:"id"`
	Type        string          `json:"type"`
	Label       string          `json:"label"`
	Position    int32           `json:"position"`
	IsActive    bool            `json:"is_active"`
	Config      json.RawMessage `json:"config"`
	ConfigValid bool            `json:"config_valid"`
	UpdatedBy   *int64          `json:"updated_by"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

// CreateInput is the body of POST /admin/homepage/sections.
type CreateInput struct {
	Type     string          `json:"type" validate:"required,max=40"`
	Label    string          `json:"label" validate:"required,max=120"`
	Config   json.RawMessage `json:"config"`
	IsActive *bool           `json:"is_active"`
}

// UpdateInput is the body of PUT /admin/homepage/sections/{id}; nil fields
// are left unchanged.
type UpdateInput struct {
	Label    *string         `json:"label" validate:"omitempty,max=120"`
	Config   json.RawMessage `json:"config"`
	IsActive *bool           `json:"is_active"`
}

// ReorderInput is the body of PUT /admin/homepage/sections/reorder.
type ReorderInput struct {
	IDs []int64 `json:"ids" validate:"required,min=1"`
}

// ResolvedSection is one entry of GET /public/homepage.
type ResolvedSection struct {
	ID     int64           `json:"id"`
	Type   string          `json:"type"`
	Config json.RawMessage `json:"config"`
	Data   any             `json:"data"`
}

// PublicHomepage is the data of GET /public/homepage.
type PublicHomepage struct {
	Sections []ResolvedSection `json:"sections"`
}

// --- resolver data shapes (docs/06 §3) ---

// HeroTrendingData is the data of hero_trending.
type HeroTrendingData struct {
	Hero     *content.ArticleCard  `json:"hero"`
	Trending []content.ArticleCard `json:"trending"`
}

// TickerItem is one breaking ticker entry.
type TickerItem struct {
	Text string  `json:"text"`
	Href *string `json:"href"`
}

// BreakingTickerData is the data of breaking_ticker.
type BreakingTickerData struct {
	Items []TickerItem `json:"items"`
}

// ArticleListData is the data of article_grid and timeline.
type ArticleListData struct {
	Items []content.ArticleCard `json:"items"`

	cands []content.ArticleCard
	pick  pickOpts
}

// CategoryWidgetItem is one entry of the sidebar categories widget.
type CategoryWidgetItem struct {
	Name         string               `json:"name"`
	Slug         string               `json:"slug"`
	URL          string               `json:"url"`
	ArticleCount int64                `json:"article_count"`
	Children     []CategoryWidgetItem `json:"children,omitempty"`
}

// TagWidgetItem is one entry of the sidebar tags widget.
type TagWidgetItem struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	URL          string `json:"url"`
	ArticleCount int64  `json:"article_count"`
}

// LatestWithSidebarData is the data of latest_with_sidebar. Widgets only
// contains the configured widget keys (popular, categories, tags,
// next_event); next_event is null when there is no upcoming event.
type LatestWithSidebarData struct {
	Items   []content.ArticleCard `json:"items"`
	Widgets map[string]any        `json:"widgets"`

	cands []content.ArticleCard
	pick  pickOpts
}

// Quote is one quote_rotator entry.
type Quote struct {
	Text   string  `json:"text"`
	Source *string `json:"source"`
}

// QuoteRotatorData is the data of quote_rotator.
type QuoteRotatorData struct {
	Quotes []Quote `json:"quotes"`
}

// FeatureSplitData is the data of feature_split.
type FeatureSplitData struct {
	Featured *content.ArticleCard  `json:"featured"`
	Items    []content.ArticleCard `json:"items"`

	featuredCands []content.ArticleCard
	cands         []content.ArticleCard
	sideLimit     int
	pick          pickOpts
}

// PeopleGridData is the data of people_grid.
type PeopleGridData struct {
	Items []content.AlumniCard `json:"items"`
}

// CalendarDay marks one event on the agenda calendar.
type CalendarDay struct {
	Day    int    `json:"day"`
	Slug   string `json:"slug"`
	IsNext bool   `json:"is_next"`
}

// Calendar is the month view of agenda_calendar.
type Calendar struct {
	Month          string        `json:"month"` // "2006-01" (WIB)
	DaysWithEvents []CalendarDay `json:"days_with_events"`
}

// AgendaCalendarData is the data of agenda_calendar; Calendar is null when
// show_calendar is false.
type AgendaCalendarData struct {
	Items    []content.EventCard `json:"items"`
	Calendar *Calendar           `json:"calendar"`
}

// VideoGalleryData is the data of video_gallery.
type VideoGalleryData struct {
	Items []content.VideoCard `json:"items"`
}

// FAQItem is one faq entry.
type FAQItem struct {
	Question   string `json:"question"`
	AnswerHTML string `json:"answer_html"`
}

// FAQData is the data of faq.
type FAQData struct {
	Items []FAQItem `json:"items"`
}

// NewsletterData is the (empty) data of newsletter.
type NewsletterData struct{}

// RichTextData is the data of rich_text.
type RichTextData struct {
	ContentHTML string `json:"content_html"`
}
