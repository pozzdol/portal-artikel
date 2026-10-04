package homepage

// Typed configs. Resolvers json.Unmarshal the normalized config (defaults
// already filled) into these; spec_test asserts that the json tags and the
// spec Fields stay in sync.

// MoreLink is the optional "see all" link of a section.
type MoreLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

// Common holds the fields every section type accepts.
type Common struct {
	AnchorID   string    `json:"anchor_id,omitempty"`
	Eyebrow    string    `json:"eyebrow,omitempty"`
	Title      string    `json:"title,omitempty"`
	MoreLink   *MoreLink `json:"more_link,omitempty"`
	Background string    `json:"background,omitempty"`
}

// DedupeOptions holds the article de-duplication switches.
type DedupeOptions struct {
	ExcludeHero bool `json:"exclude_hero"`
	Dedupe      bool `json:"dedupe"`
}

// HeroTrendingConfig configures hero_trending.
type HeroTrendingConfig struct {
	Common
	HeroSource       string `json:"hero_source"`
	HeroArticleID    *int64 `json:"hero_article_id,omitempty"`
	HeroCategorySlug string `json:"hero_category_slug,omitempty"`
	TrendingTitle    string `json:"trending_title"`
	TrendingWindow   string `json:"trending_window"`
	TrendingLimit    int    `json:"trending_limit"`
	ShowThumbnails   bool   `json:"show_thumbnails"`
}

// BreakingTickerConfig configures breaking_ticker.
type BreakingTickerConfig struct {
	Common
	Label        string `json:"label"`
	Source       string `json:"source"`
	SpeedSeconds int    `json:"speed_seconds"`
	Limit        int    `json:"limit"`
}

// ArticleGridConfig configures article_grid.
type ArticleGridConfig struct {
	Common
	DedupeOptions
	CategorySlug    string `json:"category_slug,omitempty"`
	IncludeChildren bool   `json:"include_children"`
	TagSlug         string `json:"tag_slug,omitempty"`
	Columns         int    `json:"columns"`
	Limit           int    `json:"limit"`
	ShowExcerpt     bool   `json:"show_excerpt"`
	ShowAuthor      bool   `json:"show_author"`
	ShowReadingTime bool   `json:"show_reading_time"`
	ImageRatio      string `json:"image_ratio"`
}

// LatestWithSidebarConfig configures latest_with_sidebar.
type LatestWithSidebarConfig struct {
	Common
	DedupeOptions
	ListTitle    string   `json:"list_title"`
	Limit        int      `json:"limit"`
	CategorySlug string   `json:"category_slug,omitempty"`
	Widgets      []string `json:"widgets"`
	PopularLimit int      `json:"popular_limit"`
	PopularDays  int      `json:"popular_days"`
	TagsLimit    int      `json:"tags_limit"`
}

// QuoteRotatorConfig configures quote_rotator.
type QuoteRotatorConfig struct {
	Common
	IntervalSeconds int    `json:"interval_seconds"`
	Order           string `json:"order"`
}

// TimelineConfig configures timeline.
type TimelineConfig struct {
	Common
	DedupeOptions
	CategorySlug string `json:"category_slug,omitempty"`
	Limit        int    `json:"limit"`
	OrderBy      string `json:"order_by"`
}

// FeatureSplitConfig configures feature_split.
type FeatureSplitConfig struct {
	Common
	DedupeOptions
	CategorySlug    string `json:"category_slug,omitempty"`
	FeaturedLabel   string `json:"featured_label"`
	SideLimit       int    `json:"side_limit"`
	ShowAuthorTitle bool   `json:"show_author_title"`
}

// PeopleGridConfig configures people_grid.
type PeopleGridConfig struct {
	Common
	Limit        int    `json:"limit"`
	OnlyFeatured bool   `json:"only_featured"`
	Columns      int    `json:"columns"`
	CTALabel     string `json:"cta_label"`
}

// AgendaCalendarConfig configures agenda_calendar.
type AgendaCalendarConfig struct {
	Common
	Limit         int    `json:"limit"`
	ShowCalendar  bool   `json:"show_calendar"`
	CalendarMonth string `json:"calendar_month"`
}

// VideoGalleryConfig configures video_gallery.
type VideoGalleryConfig struct {
	Common
	Limit  int    `json:"limit"`
	Layout string `json:"layout"`
}

// FAQConfig configures faq.
type FAQConfig struct {
	Common
	DefaultOpenIndex int  `json:"default_open_index"`
	Limit            *int `json:"limit,omitempty"`
}

// NewsletterConfig configures newsletter.
type NewsletterConfig struct {
	Common
	Description string `json:"description,omitempty"`
	ButtonLabel string `json:"button_label"`
	Placeholder string `json:"placeholder"`
}

// RichTextConfig configures rich_text.
type RichTextConfig struct {
	Common
	ContentHTML string `json:"content_html"`
	Align       string `json:"align"`
	MaxWidth    string `json:"max_width"`
}

// configPrototypes maps each type to a constructor of its typed config.
var configPrototypes = map[string]func() any{
	TypeHeroTrending:      func() any { return &HeroTrendingConfig{} },
	TypeBreakingTicker:    func() any { return &BreakingTickerConfig{} },
	TypeArticleGrid:       func() any { return &ArticleGridConfig{} },
	TypeLatestWithSidebar: func() any { return &LatestWithSidebarConfig{} },
	TypeQuoteRotator:      func() any { return &QuoteRotatorConfig{} },
	TypeTimeline:          func() any { return &TimelineConfig{} },
	TypeFeatureSplit:      func() any { return &FeatureSplitConfig{} },
	TypePeopleGrid:        func() any { return &PeopleGridConfig{} },
	TypeAgendaCalendar:    func() any { return &AgendaCalendarConfig{} },
	TypeVideoGallery:      func() any { return &VideoGalleryConfig{} },
	TypeFAQ:               func() any { return &FAQConfig{} },
	TypeNewsletter:        func() any { return &NewsletterConfig{} },
	TypeRichText:          func() any { return &RichTextConfig{} },
}
