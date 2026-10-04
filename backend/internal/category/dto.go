// Package category implements the category tree: an at-most-2-level
// hierarchy of article sections, each level-1 slug served at "/{slug}".
package category

// TreeNode is one category with its children (one level deep: categories are
// at most 2 levels). ArticleCount on a parent includes its children's counts.
type TreeNode struct {
	ID             int64      `json:"id"`
	ParentID       *int64     `json:"parent_id"`
	Name           string     `json:"name"`
	Slug           string     `json:"slug"`
	Description    *string    `json:"description"`
	SortOrder      int32      `json:"sort_order"`
	IsActive       bool       `json:"is_active"`
	SeoTitle       *string    `json:"seo_title"`
	SeoDescription *string    `json:"seo_description"`
	ArticleCount   int64      `json:"article_count"`
	Children       []TreeNode `json:"children"`
}

// SEO is the resolved SEO block for a category detail page: seo_title/
// seo_description when set, else the category's own name/description.
type SEO struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// PublicDetail is one category with its resolved SEO block.
type PublicDetail struct {
	TreeNode
	SEO SEO `json:"seo"`
}

// CreateInput is the body of POST /admin/categories.
type CreateInput struct {
	ParentID       *int64  `json:"parent_id"`
	Name           string  `json:"name" validate:"required,max=80"`
	Slug           string  `json:"slug" validate:"omitempty,max=160"`
	Description    *string `json:"description"`
	SortOrder      int32   `json:"sort_order"`
	IsActive       *bool   `json:"is_active"`
	SeoTitle       *string `json:"seo_title"`
	SeoDescription *string `json:"seo_description"`
}

// UpdateInput is the body of PUT /admin/categories/{id}.
type UpdateInput struct {
	ParentID       *int64  `json:"parent_id"`
	Name           string  `json:"name" validate:"required,max=80"`
	Slug           string  `json:"slug" validate:"omitempty,max=160"`
	Description    *string `json:"description"`
	SortOrder      int32   `json:"sort_order"`
	IsActive       *bool   `json:"is_active"`
	SeoTitle       *string `json:"seo_title"`
	SeoDescription *string `json:"seo_description"`
}

// ReorderItem is one row of PUT /admin/categories/reorder.
type ReorderItem struct {
	ID        int64  `json:"id" validate:"required"`
	ParentID  *int64 `json:"parent_id"`
	SortOrder int32  `json:"sort_order"`
}

// ReorderInput is the body of PUT /admin/categories/reorder.
type ReorderInput struct {
	Items []ReorderItem `json:"items" validate:"required,min=1,dive"`
}
