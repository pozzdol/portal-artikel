// Package tag implements free-form article tags: CRUD, merge and the
// public popular/detail listings.
package tag

// Item is the public and admin representation of one tag.
type Item struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	ArticleCount int64  `json:"article_count"`
	CreatedAt    string `json:"created_at,omitempty"`
}

// CreateInput is the body of POST /admin/tags.
type CreateInput struct {
	Name string `json:"name" validate:"required,max=60"`
	Slug string `json:"slug" validate:"omitempty,max=160"`
}

// UpdateInput is the body of PUT /admin/tags/{id}.
type UpdateInput struct {
	Name string `json:"name" validate:"required,max=60"`
	Slug string `json:"slug" validate:"omitempty,max=160"`
}

// MergeInput is the body of POST /admin/tags/{id}/merge.
type MergeInput struct {
	IntoID int64 `json:"into_id" validate:"required"`
}
