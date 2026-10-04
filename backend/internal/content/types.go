package content

import "portal-berita/backend/internal/dbgen"

// Media is the public representation of an uploaded file (docs/05 §1).
type Media struct {
	ID      int64   `json:"id"`
	URL     string  `json:"url"`
	Width   *int32  `json:"width"`
	Height  *int32  `json:"height"`
	Alt     *string `json:"alt"`
	Caption *string `json:"caption"`
}

// MediaFromRow converts a media row.
func MediaFromRow(m dbgen.Medium) Media {
	return Media{ID: m.ID, URL: m.Url, Width: m.Width, Height: m.Height, Alt: m.AltText, Caption: m.Caption}
}

// CategoryRef is a category reference; Parent is set (one level only) for sub-categories.
type CategoryRef struct {
	ID     int64        `json:"id"`
	Name   string       `json:"name"`
	Slug   string       `json:"slug"`
	Parent *CategoryRef `json:"parent"`
}

// Level1Slug returns the slug used as the first URL segment for articles in c.
func (c CategoryRef) Level1Slug() string {
	if c.Parent != nil {
		return c.Parent.Slug
	}
	return c.Slug
}

// AuthorRef is the public author reference on cards (never includes email).
type AuthorRef struct {
	ID          int64   `json:"id"`
	DisplayName string  `json:"display_name"`
	Slug        string  `json:"slug"`
	Title       *string `json:"title"`
	Avatar      *Media  `json:"avatar"`
}

// ArticleCard is the compact article representation (docs/05 §1).
type ArticleCard struct {
	ID             int64       `json:"id"`
	Slug           string      `json:"slug"`
	Title          string      `json:"title"`
	Excerpt        *string     `json:"excerpt"`
	URL            string      `json:"url"`
	Cover          *Media      `json:"cover"`
	Category       CategoryRef `json:"category"`
	Author         AuthorRef   `json:"author"`
	PublishedAt    *string     `json:"published_at"`
	ReadingMinutes int16       `json:"reading_minutes"`
	EventDate      *string     `json:"event_date"`
	EventLocation  *string     `json:"event_location"`
	IsFeatured     bool        `json:"is_featured"`
	IsBreaking     bool        `json:"is_breaking"`
	ViewCount      int64       `json:"view_count"`
}

// EventCard is the compact event representation.
type EventCard struct {
	ID           int64   `json:"id"`
	Slug         string  `json:"slug"`
	Title        string  `json:"title"`
	Summary      *string `json:"summary"`
	StartsAt     string  `json:"starts_at"`
	EndsAt       *string `json:"ends_at"`
	IsAllDay     bool    `json:"is_all_day"`
	LocationName string  `json:"location_name"`
	Cover        *Media  `json:"cover"`
	URL          string  `json:"url"` // /agenda/{slug}
}

// AlumniCard is the compact alumni profile representation.
type AlumniCard struct {
	ID        int64  `json:"id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	RoleTitle string `json:"role_title"`
	ClassYear *int16 `json:"class_year"`
	ShortBio  string `json:"short_bio"`
	Photo     *Media `json:"photo"`
	URL       string `json:"url"` // /tokoh/{slug}
}

// VideoCard is the compact video representation.
type VideoCard struct {
	ID              int64  `json:"id"`
	Slug            string `json:"slug"`
	Title           string `json:"title"`
	YoutubeID       string `json:"youtube_id"`
	ThumbnailURL    string `json:"thumbnail_url"` // media url or YouTube hqdefault
	DurationSeconds *int32 `json:"duration_seconds"`
	ViewCount       *int64 `json:"view_count"`
	PublishedAt     string `json:"published_at"`
	IsFeatured      bool   `json:"is_featured"`
	URL             string `json:"url"` // /video/{slug}
}

// CategoryRefsFrom builds id -> CategoryRef with parent links (one level).
func CategoryRefsFrom(rows []dbgen.Category) map[int64]CategoryRef {
	byID := make(map[int64]dbgen.Category, len(rows))
	for _, c := range rows {
		byID[c.ID] = c
	}
	out := make(map[int64]CategoryRef, len(rows))
	for _, c := range rows {
		ref := CategoryRef{ID: c.ID, Name: c.Name, Slug: c.Slug}
		if c.ParentID != nil {
			if p, ok := byID[*c.ParentID]; ok {
				ref.Parent = &CategoryRef{ID: p.ID, Name: p.Name, Slug: p.Slug}
			}
		}
		out[c.ID] = ref
	}
	return out
}
