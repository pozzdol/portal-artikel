package category

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/slugutil"
)

// Service implements the category tree, its CRUD and reordering.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a category Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// ListTree returns the full 2-level category tree. activeOnly=true drops
// inactive categories (and their children), for the public site.
func (s *Service) ListTree(ctx context.Context, activeOnly bool) ([]TreeNode, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListCategoriesWithCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("category: list: %w", err)
	}
	return BuildTree(rows, activeOnly), nil
}

// GetBySlugPublic returns one active category (root or child) by slug, with
// its resolved SEO block. apperr.NotFound when absent or inactive.
func (s *Service) GetBySlugPublic(ctx context.Context, slug string) (*PublicDetail, error) {
	tree, err := s.ListTree(ctx, true)
	if err != nil {
		return nil, err
	}
	for _, root := range tree {
		if root.Slug == slug {
			return &PublicDetail{TreeNode: root, SEO: SEOFor(root)}, nil
		}
		for _, child := range root.Children {
			if child.Slug == slug {
				return &PublicDetail{TreeNode: child, SEO: SEOFor(child)}, nil
			}
		}
	}
	return nil, apperr.NotFound()
}

// Create inserts a new category. Rules: at most 2 levels (parent must be a
// root category), a level-1 slug must not be a reserved route segment, slug
// defaults from name (with a numeric suffix on conflict) when omitted.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in CreateInput) (*TreeNode, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"name": "Wajib diisi."})
	}
	parentID, err := s.validateParent(ctx, in.ParentID, 0)
	if err != nil {
		return nil, err
	}
	slug, err := s.resolveSlug(ctx, name, strings.TrimSpace(in.Slug), 0)
	if err != nil {
		return nil, err
	}
	if parentID == nil && slugutil.IsReserved(slug) {
		return nil, apperr.Validation(map[string]string{"slug": "Slug ini dicadangkan untuk rute situs."})
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	var out *TreeNode
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		created, err := q.CreateCategory(ctx, dbgen.CreateCategoryParams{
			ParentID: parentID, Name: name, Slug: slug, Description: in.Description,
			SortOrder: in.SortOrder, IsActive: isActive,
			SeoTitle: in.SeoTitle, SeoDescription: in.SeoDescription,
		})
		if err != nil {
			return mapCategoryWriteErr(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityCategory,
			EntityID: &created.ID, Summary: "Kategori dibuat: " + created.Name,
			Changes: map[string]any{"name": created.Name, "slug": created.Slug}, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("category: audit: %w", err)
		}
		out = &TreeNode{
			ID: created.ID, ParentID: created.ParentID, Name: created.Name, Slug: created.Slug,
			Description: created.Description, SortOrder: created.SortOrder, IsActive: created.IsActive,
			SeoTitle: created.SeoTitle, SeoDescription: created.SeoDescription, Children: []TreeNode{},
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Category(out.Slug), revalidate.TagMenus, revalidate.TagHomepage, revalidate.TagSitemap)
	return out, nil
}

// Update replaces a category's fields. A category with children cannot
// become a child itself, and a level-1 slug must not become reserved.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in UpdateInput) (*TreeNode, error) {
	q := dbgen.New(s.pool)
	existing, err := q.GetCategory(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("category: get for update: %w", err)
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"name": "Wajib diisi."})
	}
	parentID, err := s.validateParent(ctx, in.ParentID, id)
	if err != nil {
		return nil, err
	}
	if parentID != nil {
		children, err := q.CountCategoryChildren(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("category: count children: %w", err)
		}
		if children > 0 {
			return nil, apperr.Validation(map[string]string{
				"parent_id": "Kategori ini memiliki sub-kategori dan tidak bisa menjadi anak.",
			})
		}
	}
	slug, err := s.resolveSlug(ctx, name, strings.TrimSpace(in.Slug), id)
	if err != nil {
		return nil, err
	}
	if parentID == nil && slugutil.IsReserved(slug) {
		return nil, apperr.Validation(map[string]string{"slug": "Slug ini dicadangkan untuk rute situs."})
	}
	isActive := existing.IsActive
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	var out *TreeNode
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		updated, err := q.UpdateCategory(ctx, dbgen.UpdateCategoryParams{
			ParentID: parentID, Name: name, Slug: slug, Description: in.Description,
			SortOrder: in.SortOrder, IsActive: isActive,
			SeoTitle: in.SeoTitle, SeoDescription: in.SeoDescription, ID: id,
		})
		if err != nil {
			return mapCategoryWriteErr(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityCategory,
			EntityID: &id, Summary: "Kategori diperbarui: " + updated.Name,
			Changes: map[string]any{"name": updated.Name, "slug": updated.Slug}, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("category: audit: %w", err)
		}
		out = &TreeNode{
			ID: updated.ID, ParentID: updated.ParentID, Name: updated.Name, Slug: updated.Slug,
			Description: updated.Description, SortOrder: updated.SortOrder, IsActive: updated.IsActive,
			SeoTitle: updated.SeoTitle, SeoDescription: updated.SeoDescription, Children: []TreeNode{},
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Category(out.Slug), revalidate.TagMenus, revalidate.TagHomepage, revalidate.TagSitemap}
	if existing.Slug != out.Slug {
		tags = append(tags, revalidate.Category(existing.Slug))
	}
	s.reval.Enqueue(tags...)
	return out, nil
}

// Delete removes a category. Refused (409) when it still has children or
// articles (of any status).
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		c, err := q.GetCategory(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("category: get for delete: %w", err)
		}
		children, err := q.CountCategoryChildren(ctx, id)
		if err != nil {
			return fmt.Errorf("category: count children: %w", err)
		}
		if children > 0 {
			return apperr.Conflict("Hapus atau pindahkan sub-kategori terlebih dahulu.")
		}
		articles, err := q.CountArticlesInCategory(ctx, id)
		if err != nil {
			return fmt.Errorf("category: count articles: %w", err)
		}
		if articles > 0 {
			return apperr.Conflict(fmt.Sprintf("Pindahkan %d artikel terlebih dahulu.", articles))
		}
		rows, err := q.DeleteCategory(ctx, id)
		if err != nil {
			return fmt.Errorf("category: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		slug = c.Slug
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityCategory,
			EntityID: &id, Summary: "Kategori dihapus: " + c.Name, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Category(slug), revalidate.TagMenus, revalidate.TagHomepage, revalidate.TagSitemap)
	return nil
}

// Reorder validates and applies a full set of (id, parent_id, sort_order)
// moves in one transaction (a two-pass renumber is not needed here: unlike
// homepage sections, categories have no unique (parent_id, sort_order)
// constraint).
func (s *Service) Reorder(ctx context.Context, meta audit.Meta, in ReorderInput) ([]TreeNode, error) {
	q := dbgen.New(s.pool)
	all, err := q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("category: list for reorder: %w", err)
	}
	byID := make(map[int64]dbgen.Category, len(all))
	childCount := make(map[int64]int64, len(all))
	for _, c := range all {
		byID[c.ID] = c
		if c.ParentID != nil {
			childCount[*c.ParentID]++
		}
	}
	for _, it := range in.Items {
		if _, ok := byID[it.ID]; !ok {
			return nil, apperr.Validation(map[string]string{"items": "Kategori tidak ditemukan."})
		}
		if it.ParentID == nil {
			continue
		}
		if *it.ParentID == it.ID {
			return nil, apperr.Validation(map[string]string{"items": "Kategori tidak boleh menjadi induk dirinya sendiri."})
		}
		parent, ok := byID[*it.ParentID]
		if !ok {
			return nil, apperr.Validation(map[string]string{"items": "Kategori induk tidak ditemukan."})
		}
		if parent.ParentID != nil {
			return nil, apperr.Validation(map[string]string{"items": "Kategori hanya boleh 2 level."})
		}
		if childCount[it.ID] > 0 {
			return nil, apperr.Validation(map[string]string{
				"items": "Kategori dengan sub-kategori tidak bisa menjadi anak.",
			})
		}
	}

	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		for _, it := range in.Items {
			if err := q.UpdateCategoryOrder(ctx, dbgen.UpdateCategoryOrderParams{
				ParentID: it.ParentID, SortOrder: it.SortOrder, ID: it.ID,
			}); err != nil {
				if _, ok := database.CheckViolation(err); ok {
					return apperr.Validation(map[string]string{"items": "Kategori hanya boleh 2 level."})
				}
				return fmt.Errorf("category: reorder: %w", err)
			}
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionReorder, EntityType: audit.EntityCategory,
			Summary: "Urutan kategori diperbarui.", IP: meta.IP,
		})
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.TagMenus, revalidate.TagHomepage, revalidate.TagSitemap)
	return s.ListTree(ctx, false)
}

// validateParent resolves and validates a candidate parent id: it must exist
// and be a root category (max 2 levels), and cannot be the category itself.
func (s *Service) validateParent(ctx context.Context, parentID *int64, selfID int64) (*int64, error) {
	if parentID == nil {
		return nil, nil
	}
	if selfID != 0 && *parentID == selfID {
		return nil, apperr.Validation(map[string]string{"parent_id": "Kategori tidak boleh menjadi induk dirinya sendiri."})
	}
	q := dbgen.New(s.pool)
	parent, err := q.GetCategory(ctx, *parentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.Validation(map[string]string{"parent_id": "Kategori induk tidak ditemukan."})
		}
		return nil, fmt.Errorf("category: get parent: %w", err)
	}
	if parent.ParentID != nil {
		return nil, apperr.Validation(map[string]string{"parent_id": "Kategori hanya boleh 2 level."})
	}
	return parentID, nil
}

// resolveSlug returns requested (validated) when non-empty, else derives one
// from name via slugutil.Make with a numeric suffix on conflict. excludeID
// (0 for create) lets a category keep its own slug on update.
func (s *Service) resolveSlug(ctx context.Context, name, requested string, excludeID int64) (string, error) {
	q := dbgen.New(s.pool)
	if requested != "" {
		if !slugutil.Valid(requested) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		return requested, nil
	}
	base := slugutil.Make(name)
	if base == "" {
		base = "kategori"
	}
	slug := base
	for attempt := 1; attempt <= 500; attempt++ {
		existing, err := q.GetCategoryBySlug(ctx, slug)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return slug, nil
		case err != nil:
			return "", fmt.Errorf("category: check slug: %w", err)
		case existing.ID == excludeID:
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, attempt+1)
	}
	return "", fmt.Errorf("category: exhausted slug suffixes for %q", base)
}

func mapCategoryWriteErr(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok && constraint == "categories_slug_key" {
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
	if _, ok := database.CheckViolation(err); ok {
		return apperr.Validation(map[string]string{"slug": "Slug ini dicadangkan untuk rute situs."})
	}
	return fmt.Errorf("category: write: %w", err)
}
