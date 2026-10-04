package menu

import (
	"context"
	"fmt"
	"strings"

	"portal-berita/backend/internal/dbgen"
)

// routeWhitelist is the set of static frontend routes a "route" link_type may
// point to (docs/04 §4.6).
var routeWhitelist = map[string]bool{
	"/": true, "/agenda": true, "/tokoh": true, "/video": true, "/cari": true,
}

// IsValidRoute reports whether target is a recognised "route" link_target.
func IsValidRoute(target string) bool { return routeWhitelist[target] }

// categoryInfo is the lookup used to resolve a "category" link_target into an
// href (§1: sub-categories have no first-level URL of their own, docs/06).
type categoryInfo struct {
	Slug       string
	ParentSlug string
	IsActive   bool
}

func categoryLookup(rows []dbgen.Category) map[string]categoryInfo {
	byID := make(map[int64]dbgen.Category, len(rows))
	for _, c := range rows {
		byID[c.ID] = c
	}
	out := make(map[string]categoryInfo, len(rows))
	for _, c := range rows {
		info := categoryInfo{Slug: c.Slug, IsActive: c.IsActive}
		if c.ParentID != nil {
			if p, ok := byID[*c.ParentID]; ok {
				info.ParentSlug = p.Slug
			}
		}
		out[c.Slug] = info
	}
	return out
}

// resolveHref computes the href for one link_type/link_target pair. ok is
// false when the target does not resolve (unknown route, missing/inactive
// category, missing page) — the public tree drops such items; the admin tree
// keeps them with an empty href.
func resolveHref(linkType, linkTarget string, cats map[string]categoryInfo, pages map[string]bool) (href string, ok bool) {
	switch linkType {
	case "route":
		if !routeWhitelist[linkTarget] {
			return "", false
		}
		return linkTarget, true
	case "anchor":
		if linkTarget == "" {
			return "", false
		}
		return "/#" + linkTarget, true
	case "url":
		if strings.HasPrefix(linkTarget, "http://") || strings.HasPrefix(linkTarget, "https://") || strings.HasPrefix(linkTarget, "/") {
			return linkTarget, true
		}
		return "", false
	case "category":
		c, found := cats[linkTarget]
		if !found || !c.IsActive {
			return "", false
		}
		if c.ParentSlug != "" {
			return "/" + c.ParentSlug + "?sub=" + c.Slug, true
		}
		return "/" + c.Slug, true
	case "page":
		if !pages[linkTarget] {
			return "", false
		}
		return "/halaman/" + linkTarget, true
	default:
		return "", false
	}
}

// pageSlugSet builds a set from ListPublishedPagesRow-like rows (only slugs
// are needed).
func pageSlugSet(slugs []string) map[string]bool {
	out := make(map[string]bool, len(slugs))
	for _, s := range slugs {
		out[s] = true
	}
	return out
}

// buildAdminTree groups items by parent and resolves every href, keeping
// inactive/unresolved items (with Href == "") so the admin UI can fix them.
func buildAdminTree(items []dbgen.MenuItem, cats map[string]categoryInfo, pages map[string]bool) []AdminItem {
	byParent := make(map[int64][]dbgen.MenuItem)
	var roots []dbgen.MenuItem
	for _, it := range items {
		if it.ParentID == nil {
			roots = append(roots, it)
			continue
		}
		byParent[*it.ParentID] = append(byParent[*it.ParentID], it)
	}
	var build func(rows []dbgen.MenuItem) []AdminItem
	build = func(rows []dbgen.MenuItem) []AdminItem {
		out := make([]AdminItem, 0, len(rows))
		for _, it := range rows {
			href, _ := resolveHref(it.LinkType, it.LinkTarget, cats, pages)
			out = append(out, AdminItem{
				ID: it.ID, Label: it.Label, LinkType: it.LinkType, LinkTarget: it.LinkTarget,
				Href: href, OpenNewTab: it.OpenNewTab, IsActive: it.IsActive, SortOrder: it.SortOrder,
				Children: build(byParent[it.ID]),
			})
		}
		return out
	}
	return build(roots)
}

// buildPublicTree groups items by parent and drops inactive items and items
// whose target does not resolve.
func buildPublicTree(items []dbgen.MenuItem, cats map[string]categoryInfo, pages map[string]bool) []PublicItem {
	byParent := make(map[int64][]dbgen.MenuItem)
	var roots []dbgen.MenuItem
	for _, it := range items {
		if it.ParentID == nil {
			roots = append(roots, it)
			continue
		}
		byParent[*it.ParentID] = append(byParent[*it.ParentID], it)
	}
	var build func(rows []dbgen.MenuItem) []PublicItem
	build = func(rows []dbgen.MenuItem) []PublicItem {
		out := make([]PublicItem, 0, len(rows))
		for _, it := range rows {
			if !it.IsActive {
				continue
			}
			href, ok := resolveHref(it.LinkType, it.LinkTarget, cats, pages)
			if !ok {
				continue
			}
			out = append(out, PublicItem{
				ID: it.ID, Label: it.Label, Href: href, OpenNewTab: it.OpenNewTab,
				Children: build(byParent[it.ID]),
			})
		}
		return out
	}
	return build(roots)
}

// ResolvePublic loads every menu and returns code -> resolved item tree. It
// is a package-level function (not a Service method) so other domains (site)
// can call it without constructing a full menu.Service.
func ResolvePublic(ctx context.Context, db dbgen.DBTX) (map[string][]PublicItem, error) {
	q := dbgen.New(db)
	menus, err := q.ListMenus(ctx)
	if err != nil {
		return nil, fmt.Errorf("menu: list menus: %w", err)
	}
	items, err := q.ListAllMenuItems(ctx)
	if err != nil {
		return nil, fmt.Errorf("menu: list all items: %w", err)
	}
	cats, pages, err := lookups(ctx, q)
	if err != nil {
		return nil, err
	}
	byMenu := make(map[int64][]dbgen.MenuItem, len(menus))
	for _, it := range items {
		byMenu[it.MenuID] = append(byMenu[it.MenuID], it)
	}
	out := make(map[string][]PublicItem, len(menus))
	for _, m := range menus {
		out[m.Code] = buildPublicTree(byMenu[m.ID], cats, pages)
	}
	return out, nil
}

func lookups(ctx context.Context, q *dbgen.Queries) (map[string]categoryInfo, map[string]bool, error) {
	catRows, err := q.ListCategories(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("menu: list categories: %w", err)
	}
	pageRows, err := q.ListPublishedPages(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("menu: list published pages: %w", err)
	}
	slugs := make([]string, len(pageRows))
	for i, p := range pageRows {
		slugs[i] = p.Slug
	}
	return categoryLookup(catRows), pageSlugSet(slugs), nil
}
