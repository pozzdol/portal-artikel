// Package article implements the article domain: admin CRUD with
// publish/schedule/unpublish, soft delete/restore, slug redirects, preview
// tokens, the scheduled-publish job and the public list/detail/author reads
// (docs/05-api.md §2 "Artikel", §4 "Artikel").
//
// handler.go / handler_public.go only decode and encode HTTP; all rules live
// in the service (admin.go, public.go, scheduler.go).
package article

import (
	"encoding/json"
	"net/http"
	"time"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Actor is the authenticated caller performing an admin action.
type Actor struct {
	UserID int64
	Perms  rbac.Set
	Meta   audit.Meta
}

// ActorFromRequest builds an Actor from the request's authenticated
// principal (via authctx, never package auth) and permission set.
func ActorFromRequest(r *http.Request) Actor {
	p, _ := authctx.FromContext(r.Context())
	return Actor{
		UserID: p.UserID,
		Perms:  rbac.PermissionsFromContext(r.Context()),
		Meta:   audit.RequestMeta(r),
	}
}

// MaxContentHTMLBytes bounds the submitted content_html (before sanitizing).
const MaxContentHTMLBytes = 512 << 10

// Input is the POST /admin/articles and PUT /admin/articles/{id} body
// (docs/05-api.md §4). PUT is a full replace of the editable fields; status
// and published_at are only changed through publish/unpublish. A nil/empty
// Slug auto-generates one from the title on create and keeps the current slug
// on update. A nil AuthorID defaults to the actor. content_html is always
// sanitized server side (richtext.Sanitize); content_text, reading_minutes
// and (when empty) excerpt are derived from it.
type Input struct {
	Title          string          `json:"title" validate:"required,max=200"`
	Slug           *string         `json:"slug" validate:"omitempty,max=160"`
	Excerpt        *string         `json:"excerpt" validate:"omitempty,max=300"`
	ContentJSON    json.RawMessage `json:"content_json" validate:"required"`
	ContentHTML    *string         `json:"content_html" validate:"required,max=524288"`
	CoverMediaID   *int64          `json:"cover_media_id" validate:"omitempty,gt=0"`
	CoverCaption   *string         `json:"cover_caption" validate:"omitempty,max=300"`
	CategoryID     int64           `json:"category_id" validate:"required,gt=0"`
	AuthorID       *int64          `json:"author_id" validate:"omitempty,gt=0"`
	TagIDs         []int64         `json:"tag_ids" validate:"omitempty,max=20,dive,gt=0"`
	NewTags        []string        `json:"new_tags" validate:"omitempty,max=10,dive,required,max=60"`
	IsFeatured     bool            `json:"is_featured"`
	IsBreaking     bool            `json:"is_breaking"`
	EventDate      *string         `json:"event_date" validate:"omitempty,datetime=2006-01-02"`
	EventLocation  *string         `json:"event_location" validate:"omitempty,max=200"`
	SeoTitle       *string         `json:"seo_title" validate:"omitempty,max=200"`
	SeoDescription *string         `json:"seo_description" validate:"omitempty,max=300"`
	OgMediaID      *int64          `json:"og_media_id" validate:"omitempty,gt=0"`
	CanonicalURL   *string         `json:"canonical_url" validate:"omitempty,url,max=500"`
}

// PublishInput is the optional POST /admin/articles/{id}/publish body.
// published_at nil or in the past publishes now (a past value back-dates);
// a future value schedules the article.
type PublishInput struct {
	PublishedAt *time.Time `json:"published_at"`
}

// Sort values accepted by the admin list (anything else = "-updated_at").
var adminSorts = []string{"-updated_at", "-published_at", "published_at", "title", "-title", "-view_count"}

// ListFilter narrows GET /admin/articles.
type ListFilter struct {
	Q        string
	Status   string // "" = any
	Category string // slug; includes children
	AuthorID int64  // 0 = any
	Trashed  bool
	Sort     string
	Page     httpx.Pagination
}

// PublicFilter narrows GET /public/articles. Unknown slugs yield an empty list.
type PublicFilter struct {
	Category string // slug; includes active children
	Tag      string
	Author   string
	Featured *bool
	Page     httpx.Pagination
}

// TagRef is a tag attached to an article.
type TagRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	URL  string `json:"url"`
}

// AdminItem is one row of GET /admin/articles: the public card plus the
// editorial state.
type AdminItem struct {
	content.ArticleCard
	Status    string  `json:"status"`
	CreatedBy *int64  `json:"created_by"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
	DeletedAt *string `json:"deleted_at"`
}

// AdminSEO is the editable SEO block of an admin article.
type AdminSEO struct {
	Title        *string        `json:"title"`
	Description  *string        `json:"description"`
	OgMediaID    *int64         `json:"og_media_id"`
	Og           *content.Media `json:"og"`
	CanonicalURL *string        `json:"canonical_url"`
}

// AdminDetail is the body of GET/POST/PUT and the publish actions on one
// admin article.
type AdminDetail struct {
	AdminItem
	CategoryID   int64           `json:"category_id"`
	AuthorID     int64           `json:"author_id"`
	CoverMediaID *int64          `json:"cover_media_id"`
	CoverCaption *string         `json:"cover_caption"`
	ContentJSON  json.RawMessage `json:"content_json"`
	ContentHTML  string          `json:"content_html"`
	Tags         []TagRef        `json:"tags"`
	SEO          AdminSEO        `json:"seo"`
}

// PublicSEO is the resolved SEO block of a public article: fallbacks are
// applied (title → article title, description → excerpt, og → cover,
// canonical → PUBLIC_SITE_URL + url).
type PublicSEO struct {
	Title        string         `json:"title"`
	Description  *string        `json:"description"`
	Og           *content.Media `json:"og"`
	CanonicalURL string         `json:"canonical_url"`
}

// PublicDetail is GET /public/articles/{slug}.
type PublicDetail struct {
	content.ArticleCard
	CoverCaption *string               `json:"cover_caption"`
	ContentHTML  string                `json:"content_html"`
	Tags         []TagRef              `json:"tags"`
	SEO          PublicSEO             `json:"seo"`
	Related      []content.ArticleCard `json:"related"`
	UpdatedAt    string                `json:"updated_at"`
	// Preview is true when the article was served through a valid preview
	// token (it may be unpublished). Handlers then send Cache-Control: no-store.
	Preview bool `json:"preview,omitempty"`
}

// Redirect is returned (HTTP 200) for a slug that moved:
// {"data":{"redirect":"/kajian/slug-baru"}}. The frontend performs the 308.
type Redirect struct {
	To string `json:"redirect"`
}

// SlugCheck is GET /admin/articles/slug-check.
type SlugCheck struct {
	Slug       string  `json:"slug"`
	Available  bool    `json:"available"`
	Suggestion *string `json:"suggestion,omitempty"`
}

// PreviewToken is GET /admin/articles/{id}/preview-token.
type PreviewToken struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
	URL       string `json:"url"`
}

// AuthorProfile is GET /public/authors/{slug} (never includes email).
type AuthorProfile struct {
	ID          int64          `json:"id"`
	DisplayName string         `json:"display_name"`
	Slug        string         `json:"slug"`
	Title       *string        `json:"title"`
	Bio         *string        `json:"bio"`
	Avatar      *content.Media `json:"avatar"`
	URL         string         `json:"url"`
}
