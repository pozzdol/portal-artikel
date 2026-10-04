// Package page implements static-page ("Halaman") admin CRUD and public
// lookup (docs/05-api.md §3 "Agenda, Tokoh, Video, Halaman, Snippet").
package page

import "encoding/json"

// SEO is the seo_title/seo_description pair rendered on detail responses.
type SEO struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

// Item is the admin representation of one static page.
type Item struct {
	ID          int64           `json:"id"`
	Title       string          `json:"title"`
	Slug        string          `json:"slug"`
	ContentJSON json.RawMessage `json:"content_json"`
	ContentHTML string          `json:"content_html"`
	Status      string          `json:"status"`
	OgMediaID   *int64          `json:"og_media_id"`
	SEO         SEO             `json:"seo"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

// Input is the body of POST/PUT /admin/pages/{id}.
type Input struct {
	Title          string          `json:"title" validate:"required,max=200"`
	Slug           string          `json:"slug" validate:"omitempty,max=160"`
	ContentJSON    json.RawMessage `json:"content_json"`
	ContentHTML    string          `json:"content_html"`
	Status         string          `json:"status" validate:"omitempty,oneof=draft published"`
	OgMediaID      *int64          `json:"og_media_id"`
	SEOTitle       *string         `json:"seo_title" validate:"omitempty,max=200"`
	SEODescription *string         `json:"seo_description" validate:"omitempty,max=300"`
}

// PublicDetail is the public static-page detail response.
type PublicDetail struct {
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	ContentHTML string `json:"content_html"`
	SEO         SEO    `json:"seo"`
	UpdatedAt   string `json:"updated_at"`
}
