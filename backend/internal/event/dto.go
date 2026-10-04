// Package event implements the agenda (event) admin CRUD and public listing
// (docs/05-api.md §3 "Agenda, Tokoh, Video, Halaman, Snippet").
package event

import (
	"encoding/json"
	"time"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/httpx"
)

// SEO is the seo_title/seo_description pair rendered on detail responses.
type SEO struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

// Item is the admin representation of one event (list and detail share this
// shape; list responses simply carry lighter values for the JSONB/HTML
// fields via the same struct).
type Item struct {
	ID              int64           `json:"id"`
	Title           string          `json:"title"`
	Slug            string          `json:"slug"`
	Summary         *string         `json:"summary"`
	DescriptionJSON json.RawMessage `json:"description_json"`
	DescriptionHTML string          `json:"description_html"`
	StartsAt        string          `json:"starts_at"`
	EndsAt          *string         `json:"ends_at"`
	IsAllDay        bool            `json:"is_all_day"`
	LocationName    string          `json:"location_name"`
	LocationAddress *string         `json:"location_address"`
	MapsURL         *string         `json:"maps_url"`
	CoverMediaID    *int64          `json:"cover_media_id"`
	RegistrationURL *string         `json:"registration_url"`
	Status          string          `json:"status"`
	SEO             SEO             `json:"seo"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
}

// Input is the body of POST/PUT /admin/events/{id}.
type Input struct {
	Title           string          `json:"title" validate:"required,max=200"`
	Slug            string          `json:"slug" validate:"omitempty,max=160"`
	Summary         *string         `json:"summary" validate:"omitempty,max=500"`
	DescriptionJSON json.RawMessage `json:"description_json"`
	DescriptionHTML string          `json:"description_html"`
	StartsAt        string          `json:"starts_at" validate:"required"`
	EndsAt          *string         `json:"ends_at" validate:"omitempty"`
	IsAllDay        bool            `json:"is_all_day"`
	LocationName    string          `json:"location_name" validate:"required,max=200"`
	LocationAddress *string         `json:"location_address" validate:"omitempty,max=500"`
	MapsURL         *string         `json:"maps_url" validate:"omitempty,max=500"`
	CoverMediaID    *int64          `json:"cover_media_id"`
	RegistrationURL *string         `json:"registration_url" validate:"omitempty,max=500"`
	Status          string          `json:"status" validate:"omitempty,oneof=draft published cancelled"`
	SEOTitle        *string         `json:"seo_title" validate:"omitempty,max=200"`
	SEODescription  *string         `json:"seo_description" validate:"omitempty,max=300"`
}

// ListFilter is the admin listing filter.
type ListFilter struct {
	Q      string
	Status string
	Page   httpx.Pagination
}

// PublicFilter is the public listing filter (§1 "when"/month semantics).
type PublicFilter struct {
	When      string // "upcoming" | "past" | "" (no time filter)
	MonthFrom *time.Time
	MonthTo   *time.Time
	Page      httpx.Pagination
}

// PublicDetail is the public event detail response.
type PublicDetail struct {
	ID              int64          `json:"id"`
	Slug            string         `json:"slug"`
	Title           string         `json:"title"`
	Summary         *string        `json:"summary"`
	URL             string         `json:"url"`
	StartsAt        string         `json:"starts_at"`
	EndsAt          *string        `json:"ends_at"`
	IsAllDay        bool           `json:"is_all_day"`
	LocationName    string         `json:"location_name"`
	LocationAddress *string        `json:"location_address"`
	MapsURL         *string        `json:"maps_url"`
	Cover           *content.Media `json:"cover"`
	RegistrationURL *string        `json:"registration_url"`
	DescriptionHTML string         `json:"description_html"`
	Status          string         `json:"status"`
	SEO             SEO            `json:"seo"`
}
