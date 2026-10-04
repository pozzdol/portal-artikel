package menu

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/revalidate"
)

// maxDepth is the maximum menu tree depth (parent + one child level).
const maxDepth = 2

// Service implements menu admin reads and the item-tree replace.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a menu Service. reval is nil-safe (pass revalidate.Noop{}).
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// ListAll returns every menu with its resolved item tree (admin view: items
// with an unresolved target are kept, with Href == "").
func (s *Service) ListAll(ctx context.Context) ([]MenuWithItems, error) {
	q := dbgen.New(s.pool)
	menus, err := q.ListMenus(ctx)
	if err != nil {
		return nil, fmt.Errorf("menu: list menus: %w", err)
	}
	items, err := q.ListAllMenuItems(ctx)
	if err != nil {
		return nil, fmt.Errorf("menu: list all items: %w", err)
	}
	cats, pages, err := adminLookups(ctx, q)
	if err != nil {
		return nil, err
	}
	byMenu := make(map[int64][]dbgen.MenuItem, len(menus))
	for _, it := range items {
		byMenu[it.MenuID] = append(byMenu[it.MenuID], it)
	}
	out := make([]MenuWithItems, len(menus))
	for i, m := range menus {
		out[i] = MenuWithItems{Code: m.Code, Name: m.Name, Items: buildAdminTree(byMenu[m.ID], cats, pages)}
	}
	return out, nil
}

// GetByCode returns one menu with its resolved item tree, or apperr.NotFound.
func (s *Service) GetByCode(ctx context.Context, code string) (*MenuWithItems, error) {
	q := dbgen.New(s.pool)
	m, err := q.GetMenuByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("menu: get by code: %w", err)
	}
	items, err := q.ListMenuItems(ctx, m.ID)
	if err != nil {
		return nil, fmt.Errorf("menu: list items: %w", err)
	}
	cats, pages, err := adminLookups(ctx, q)
	if err != nil {
		return nil, err
	}
	return &MenuWithItems{Code: m.Code, Name: m.Name, Items: buildAdminTree(items, cats, pages)}, nil
}

// ReplaceItems validates and replaces the whole item tree of one menu in a
// single transaction (§ docs/04 4.6: max 2 levels).
func (s *Service) ReplaceItems(ctx context.Context, meta audit.Meta, code string, in ItemsInput) (*MenuWithItems, error) {
	q := dbgen.New(s.pool)
	m, err := q.GetMenuByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("menu: get by code: %w", err)
	}
	catSlugs, pageSlugs, err := adminSlugSets(ctx, q)
	if err != nil {
		return nil, err
	}
	if fields := validateTree(in.Items, "items", 1, catSlugs, pageSlugs); len(fields) > 0 {
		return nil, apperr.Validation(fields)
	}

	var out *MenuWithItems
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := dbgen.New(tx)
		if err := qtx.DeleteMenuItems(ctx, m.ID); err != nil {
			return fmt.Errorf("menu: delete items: %w", err)
		}
		if err := insertTree(ctx, qtx, m.ID, nil, in.Items); err != nil {
			return err
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityMenu,
			EntityID: &m.ID, Summary: "Menu diperbarui: " + m.Name,
			Changes: map[string]any{"code": m.Code, "item_count": len(in.Items)},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("menu: audit: %w", err)
		}
		items, err := qtx.ListMenuItems(ctx, m.ID)
		if err != nil {
			return fmt.Errorf("menu: reload items: %w", err)
		}
		cats, pages, err := adminLookups(ctx, qtx)
		if err != nil {
			return err
		}
		out = &MenuWithItems{Code: m.Code, Name: m.Name, Items: buildAdminTree(items, cats, pages)}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.TagMenus)
	return out, nil
}

// insertTree inserts items (and their one level of children) under parentID,
// numbering sort_order 10, 20, 30, ... in array order.
func insertTree(ctx context.Context, q *dbgen.Queries, menuID int64, parentID *int64, items []ItemInput) error {
	for i, it := range items {
		id, err := q.CreateMenuItem(ctx, dbgen.CreateMenuItemParams{
			MenuID: menuID, ParentID: parentID, Label: it.Label, LinkType: it.LinkType,
			LinkTarget: it.LinkTarget, OpenNewTab: it.OpenNewTab, SortOrder: int32((i + 1) * 10), IsActive: it.IsActive,
		})
		if err != nil {
			return fmt.Errorf("menu: create item: %w", err)
		}
		if len(it.Children) > 0 {
			childID := id
			if err := insertTree(ctx, q, menuID, &childID, it.Children); err != nil {
				return err
			}
		}
	}
	return nil
}

// validateTree checks link_type-specific target validity and the 2-level
// depth cap, returning field errors keyed like "items[0].children[1].link_target".
func validateTree(items []ItemInput, prefix string, depth int, cats, pages map[string]bool) map[string]string {
	fields := map[string]string{}
	var walk func(items []ItemInput, prefix string, depth int)
	walk = func(items []ItemInput, prefix string, depth int) {
		for i, it := range items {
			path := fmt.Sprintf("%s[%d]", prefix, i)
			switch it.LinkType {
			case "route":
				if !IsValidRoute(it.LinkTarget) {
					fields[path+".link_target"] = "Rute tidak dikenal."
				}
			case "category":
				if !cats[it.LinkTarget] {
					fields[path+".link_target"] = "Kategori tidak ditemukan."
				}
			case "page":
				if !pages[it.LinkTarget] {
					fields[path+".link_target"] = "Halaman tidak ditemukan."
				}
			case "url":
				if _, ok := resolveHref("url", it.LinkTarget, nil, nil); !ok {
					fields[path+".link_target"] = "URL harus diawali http://, https://, atau /."
				}
			}
			if len(it.Children) > 0 {
				if depth >= maxDepth {
					fields[path+".children"] = "Menu hanya boleh 2 level."
					continue
				}
				walk(it.Children, path+".children", depth+1)
			}
		}
	}
	walk(items, prefix, depth)
	return fields
}

// adminLookups builds the category/page lookups used to resolve hrefs for the
// admin tree (every category and every page, regardless of status).
func adminLookups(ctx context.Context, q *dbgen.Queries) (map[string]categoryInfo, map[string]bool, error) {
	cats, err := q.ListCategories(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("menu: list categories: %w", err)
	}
	pages, err := q.ListPages(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("menu: list pages: %w", err)
	}
	slugs := make([]string, len(pages))
	for i, p := range pages {
		slugs[i] = p.Slug
	}
	return categoryLookup(cats), pageSlugSet(slugs), nil
}

// adminSlugSets is adminLookups reduced to plain slug sets, used for input
// validation (any existing category/page, active or not).
func adminSlugSets(ctx context.Context, q *dbgen.Queries) (cats map[string]bool, pages map[string]bool, err error) {
	catLookup, pageLookup, err := adminLookups(ctx, q)
	if err != nil {
		return nil, nil, err
	}
	cats = make(map[string]bool, len(catLookup))
	for slug := range catLookup {
		cats[slug] = true
	}
	return cats, pageLookup, nil
}
