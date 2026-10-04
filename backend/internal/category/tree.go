package category

import "portal-berita/backend/internal/dbgen"

// BuildTree assembles the flat, already-ordered (parent_id NULLS FIRST,
// sort_order, id) rows from ListCategoriesWithCounts into a 2-level tree.
// When activeOnly is true, inactive categories are dropped, and a child whose
// parent was dropped is dropped with it (categories are at most 2 levels, so
// this cannot orphan a grandchild). A parent's ArticleCount is the sum of its
// own count and its (surviving) children's counts.
func BuildTree(rows []dbgen.ListCategoriesWithCountsRow, activeOnly bool) []TreeNode {
	byID := make(map[int64]dbgen.ListCategoriesWithCountsRow, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
	}
	include := func(r dbgen.ListCategoriesWithCountsRow) bool {
		if !activeOnly {
			return true
		}
		if !r.IsActive {
			return false
		}
		if r.ParentID != nil {
			parent, ok := byID[*r.ParentID]
			if !ok || !parent.IsActive {
				return false
			}
		}
		return true
	}

	nodes := make(map[int64]*TreeNode, len(rows))
	var roots []*TreeNode
	for _, r := range rows {
		if r.ParentID != nil || !include(r) {
			continue
		}
		n := nodeFromRow(r)
		nodes[r.ID] = n
		roots = append(roots, n)
	}
	for _, r := range rows {
		if r.ParentID == nil || !include(r) {
			continue
		}
		parent, ok := nodes[*r.ParentID]
		if !ok {
			continue
		}
		child := nodeFromRow(r)
		parent.ArticleCount += child.ArticleCount
		parent.Children = append(parent.Children, *child)
	}

	out := make([]TreeNode, 0, len(roots))
	for _, r := range roots {
		out = append(out, *r)
	}
	return out
}

func nodeFromRow(r dbgen.ListCategoriesWithCountsRow) *TreeNode {
	return &TreeNode{
		ID:             r.ID,
		ParentID:       r.ParentID,
		Name:           r.Name,
		Slug:           r.Slug,
		Description:    r.Description,
		SortOrder:      r.SortOrder,
		IsActive:       r.IsActive,
		SeoTitle:       r.SeoTitle,
		SeoDescription: r.SeoDescription,
		ArticleCount:   r.ArticleCount,
		Children:       []TreeNode{},
	}
}

// SEOFor resolves the SEO block for n: seo_title/seo_description when set,
// else its own name/description.
func SEOFor(n TreeNode) SEO {
	title := n.Name
	if n.SeoTitle != nil && *n.SeoTitle != "" {
		title = *n.SeoTitle
	}
	var description string
	if n.Description != nil {
		description = *n.Description
	}
	if n.SeoDescription != nil && *n.SeoDescription != "" {
		description = *n.SeoDescription
	}
	return SEO{Title: title, Description: description}
}
