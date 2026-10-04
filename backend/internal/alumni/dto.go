// Package alumni implements the alumni profile ("Tokoh") admin CRUD and
// public listing (docs/05-api.md §3 "Agenda, Tokoh, Video, Halaman, Snippet").
package alumni

import (
	"encoding/json"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/httpx"
)

// SEO is the seo_title/seo_description pair rendered on detail responses.
type SEO struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

// Item is the admin representation of one alumni profile.
type Item struct {
	ID           int64           `json:"id"`
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	RoleTitle    string          `json:"role_title"`
	ClassYear    *int16          `json:"class_year"`
	ShortBio     string          `json:"short_bio"`
	StoryJSON    json.RawMessage `json:"story_json"`
	StoryHTML    string          `json:"story_html"`
	PhotoMediaID *int64          `json:"photo_media_id"`
	IsFeatured   bool            `json:"is_featured"`
	SortOrder    int32           `json:"sort_order"`
	Status       string          `json:"status"`
	SEO          SEO             `json:"seo"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
}

// Input is the body of POST/PUT /admin/alumni/{id}.
type Input struct {
	Name           string          `json:"name" validate:"required,max=200"`
	Slug           string          `json:"slug" validate:"omitempty,max=160"`
	RoleTitle      string          `json:"role_title" validate:"required,max=200"`
	ClassYear      *int16          `json:"class_year" validate:"omitempty,gte=1900,lte=2100"`
	ShortBio       string          `json:"short_bio" validate:"required,max=500"`
	StoryJSON      json.RawMessage `json:"story_json"`
	StoryHTML      string          `json:"story_html"`
	PhotoMediaID   *int64          `json:"photo_media_id"`
	IsFeatured     bool            `json:"is_featured"`
	SortOrder      int32           `json:"sort_order"`
	Status         string          `json:"status" validate:"omitempty,oneof=draft published"`
	SEOTitle       *string         `json:"seo_title" validate:"omitempty,max=200"`
	SEODescription *string         `json:"seo_description" validate:"omitempty,max=300"`
}

// ListFilter is the admin listing filter.
type ListFilter struct {
	Q      string
	Status string
	Page   httpx.Pagination
}

// PublicFilter is the public listing filter.
type PublicFilter struct {
	Featured *bool
	Page     httpx.Pagination
}

// ReorderInput is the body of PUT /admin/alumni/reorder.
type ReorderInput struct {
	Items []ReorderItem `json:"items" validate:"required,min=1,dive"`
}

// ReorderItem is one row of a reorder request.
type ReorderItem struct {
	ID        int64 `json:"id" validate:"required"`
	SortOrder int32 `json:"sort_order"`
}

// PublicDetail is the public alumni profile detail response.
type PublicDetail struct {
	ID        int64          `json:"id"`
	Slug      string         `json:"slug"`
	Name      string         `json:"name"`
	RoleTitle string         `json:"role_title"`
	ClassYear *int16         `json:"class_year"`
	ShortBio  string         `json:"short_bio"`
	URL       string         `json:"url"`
	Photo     *content.Media `json:"photo"`
	StoryHTML string         `json:"story_html"`
	SEO       SEO            `json:"seo"`
}
