// Package snippet implements short-content admin CRUD and public listing for
// announcements, breaking-news ticker items, quotes and FAQ entries
// (docs/05-api.md §3 "Agenda, Tokoh, Video, Halaman, Snippet").
package snippet

// Type constants (snippets.type CHECK).
const (
	TypeAnnouncement = "announcement"
	TypeBreaking     = "breaking"
	TypeQuote        = "quote"
	TypeFAQ          = "faq"
)

// Item is the admin representation of one snippet.
type Item struct {
	ID        int64   `json:"id"`
	Type      string  `json:"type"`
	Title     *string `json:"title"`
	Body      string  `json:"body"`
	Source    *string `json:"source"`
	LinkURL   *string `json:"link_url"`
	SortOrder int32   `json:"sort_order"`
	IsActive  bool    `json:"is_active"`
	StartsAt  *string `json:"starts_at"`
	EndsAt    *string `json:"ends_at"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

// Input is the body of POST/PUT /admin/snippets/{id}.
type Input struct {
	Type      string  `json:"type" validate:"required,oneof=announcement breaking quote faq"`
	Title     *string `json:"title" validate:"omitempty,max=300"`
	Body      string  `json:"body" validate:"required,max=5000"`
	Source    *string `json:"source" validate:"omitempty,max=200"`
	LinkURL   *string `json:"link_url" validate:"omitempty,max=500"`
	SortOrder int32   `json:"sort_order"`
	IsActive  bool    `json:"is_active"`
	StartsAt  *string `json:"starts_at" validate:"omitempty"`
	EndsAt    *string `json:"ends_at" validate:"omitempty"`
}

// ReorderInput is the body of PUT /admin/snippets/reorder.
type ReorderInput struct {
	Items []ReorderItem `json:"items" validate:"required,min=1,dive"`
}

// ReorderItem is one row of a reorder request.
type ReorderItem struct {
	ID        int64 `json:"id" validate:"required"`
	SortOrder int32 `json:"sort_order"`
}

// PublicItem is the public representation of one active snippet.
type PublicItem struct {
	ID      int64   `json:"id"`
	Type    string  `json:"type"`
	Title   *string `json:"title"`
	Body    string  `json:"body"`
	Source  *string `json:"source"`
	LinkURL *string `json:"link_url"`
}
