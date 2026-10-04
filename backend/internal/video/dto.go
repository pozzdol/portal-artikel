// Package video implements the video listing admin CRUD and public listing
// (docs/05-api.md §3 "Agenda, Tokoh, Video, Halaman, Snippet").
package video

import (
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/httpx"
)

// Item is the admin representation of one video.
type Item struct {
	ID               int64   `json:"id"`
	Title            string  `json:"title"`
	Slug             string  `json:"slug"`
	YoutubeID        string  `json:"youtube_id"`
	Description      *string `json:"description"`
	DurationSeconds  *int32  `json:"duration_seconds"`
	ViewCount        *int64  `json:"view_count"`
	ThumbnailMediaID *int64  `json:"thumbnail_media_id"`
	PublishedAt      string  `json:"published_at"`
	IsFeatured       bool    `json:"is_featured"`
	Status           string  `json:"status"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

// Input is the body of POST/PUT /admin/videos/{id}.
type Input struct {
	Title            string  `json:"title" validate:"required,max=200"`
	Slug             string  `json:"slug" validate:"omitempty,max=160"`
	YoutubeID        string  `json:"youtube_id" validate:"required,len=11"`
	Description      *string `json:"description" validate:"omitempty,max=2000"`
	DurationSeconds  *int32  `json:"duration_seconds" validate:"omitempty,gte=0"`
	ViewCount        *int64  `json:"view_count" validate:"omitempty,gte=0"`
	ThumbnailMediaID *int64  `json:"thumbnail_media_id"`
	PublishedAt      *string `json:"published_at" validate:"omitempty"`
	IsFeatured       bool    `json:"is_featured"`
	Status           string  `json:"status" validate:"omitempty,oneof=draft published"`
}

// ParseURLInput is the body of POST /admin/videos/parse-url.
type ParseURLInput struct {
	URL string `json:"url" validate:"required"`
}

// ParseURLResult is the response of POST /admin/videos/parse-url.
type ParseURLResult struct {
	YoutubeID    string `json:"youtube_id"`
	ThumbnailURL string `json:"thumbnail_url"`
}

// ListFilter is the admin listing filter.
type ListFilter struct {
	Q      string
	Status string
	Page   httpx.Pagination
}

// PublicDetail is the public video detail response.
type PublicDetail struct {
	content.VideoCard
	Description *string             `json:"description"`
	EmbedURL    string              `json:"embed_url"`
	Others      []content.VideoCard `json:"others"`
}
