package homepage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

const orderPublishedAt = "published_at"

func decodeConfig(raw json.RawMessage, v any) error {
	if err := json.Unmarshal(raw, v); err != nil {
		return fmt.Errorf("homepage: decode config: %w", err)
	}
	return nil
}

func fetchSize(limit int, dedupe bool) int32 {
	if dedupe {
		return int32(limit + dedupeExtra)
	}
	return int32(limit)
}

// articleFilter resolves category/tag slugs to ids. ok is false when a
// configured slug does not exist (or the category is inactive): the section
// is then empty rather than silently unfiltered.
func (rc *resolveCtx) articleFilter(ctx context.Context, categorySlug string, includeChildren bool, tagSlug string) (catIDs []int64, tagID *int64, ok bool, err error) {
	if categorySlug != "" {
		ids, found := rc.cats.ids(categorySlug, includeChildren)
		if !found {
			return nil, nil, false, nil
		}
		catIDs = ids
	}
	if tagSlug != "" {
		t, err := rc.q.GetTagBySlug(ctx, tagSlug)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, false, nil
		}
		if err != nil {
			return nil, nil, false, fmt.Errorf("homepage: get tag: %w", err)
		}
		tagID = &t.ID
	}
	return catIDs, tagID, true, nil
}

// articlesByIDs loads published articles and returns them in ids order
// (unpublished/missing ids dropped).
func (rc *resolveCtx) articlesByIDs(ctx context.Context, ids []int64) ([]dbgen.Article, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := rc.q.ListPublishedArticlesByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("homepage: list articles by ids: %w", err)
	}
	byID := make(map[int64]dbgen.Article, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
	}
	out := make([]dbgen.Article, 0, len(ids))
	for _, id := range ids {
		if r, ok := byID[id]; ok {
			out = append(out, r)
		}
	}
	return out, nil
}

// topViewed returns the most viewed published articles over the last `days`
// WIB days (today included), excluding excludeID.
func (rc *resolveCtx) topViewed(ctx context.Context, days, limit int, excludeID int64) ([]dbgen.Article, error) {
	today := httpx.WIBDate(rc.now)
	top, err := rc.q.ListTopArticleViews(ctx, dbgen.ListTopArticleViewsParams{
		FromDay: today.AddDate(0, 0, -(days - 1)), ToDay: today, Limit: int32(limit + 1),
	})
	if err != nil {
		return nil, fmt.Errorf("homepage: top article views: %w", err)
	}
	ids := make([]int64, 0, limit)
	for _, t := range top {
		if t.ArticleID != excludeID && len(ids) < limit {
			ids = append(ids, t.ArticleID)
		}
	}
	return rc.articlesByIDs(ctx, ids)
}

// --- hero_trending ---

func resolveHeroTrending(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg HeroTrendingConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	hero, err := rc.pickHero(ctx, cfg)
	if err != nil {
		return nil, err
	}
	var heroID int64
	if hero != nil {
		heroID = hero.ID
	}
	days := 1
	if cfg.TrendingWindow == "week" {
		days = 7
	}
	trending, err := rc.topViewed(ctx, days, cfg.TrendingLimit, heroID)
	if err != nil {
		return nil, err
	}
	if missing := cfg.TrendingLimit - len(trending); missing > 0 {
		exclude := make([]int64, 0, len(trending)+1)
		if heroID != 0 {
			exclude = append(exclude, heroID)
		}
		for _, a := range trending {
			exclude = append(exclude, a.ID)
		}
		fill, err := rc.q.ListLatestPublishedExcluding(ctx, dbgen.ListLatestPublishedExcludingParams{
			ExcludeIds: exclude, Limit: int32(missing),
		})
		if err != nil {
			return nil, fmt.Errorf("homepage: trending fallback: %w", err)
		}
		trending = append(trending, fill...)
	}
	rows := trending
	if hero != nil {
		rows = append([]dbgen.Article{*hero}, trending...)
	}
	cards, err := rc.hyd.Cards(ctx, rows)
	if err != nil {
		return nil, err
	}
	data := &HeroTrendingData{Trending: cards}
	if hero != nil {
		data.Hero = &cards[0]
		data.Trending = cards[1:]
	}
	return data, nil
}

// pickHero follows hero_source with fallbacks manual → featured → latest.
func (rc *resolveCtx) pickHero(ctx context.Context, cfg HeroTrendingConfig) (*dbgen.Article, error) {
	var catIDs []int64
	if cfg.HeroCategorySlug != "" {
		if ids, ok := rc.cats.ids(cfg.HeroCategorySlug, true); ok {
			catIDs = ids
		}
	}
	if cfg.HeroSource == "manual" && cfg.HeroArticleID != nil {
		rows, err := rc.articlesByIDs(ctx, []int64{*cfg.HeroArticleID})
		if err != nil {
			return nil, err
		}
		if len(rows) == 1 {
			return &rows[0], nil
		}
	}
	if cfg.HeroSource != "latest" {
		rows, err := rc.q.ListFeaturedPublished(ctx, dbgen.ListFeaturedPublishedParams{CategoryIds: catIDs, Limit: 1})
		if err != nil {
			return nil, fmt.Errorf("homepage: featured hero: %w", err)
		}
		if len(rows) == 1 {
			return &rows[0], nil
		}
	}
	rows, err := rc.q.ListPublishedByCategoryOrdered(ctx, dbgen.ListPublishedByCategoryOrderedParams{
		CategoryIds: catIDs, OrderBy: orderPublishedAt, Limit: 1,
	})
	if err != nil {
		return nil, fmt.Errorf("homepage: latest hero: %w", err)
	}
	if len(rows) == 1 {
		return &rows[0], nil
	}
	return nil, nil
}

// --- breaking_ticker ---

func resolveBreakingTicker(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg BreakingTickerConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	items := make([]TickerItem, 0, cfg.Limit)
	if cfg.Source == "snippets" || cfg.Source == "both" {
		typ := "breaking"
		snips, err := rc.q.ListActiveSnippets(ctx, dbgen.ListActiveSnippetsParams{Type: &typ, Now: rc.now})
		if err != nil {
			return nil, fmt.Errorf("homepage: breaking snippets: %w", err)
		}
		for _, sn := range snips {
			var href *string
			if sn.LinkUrl != nil && strings.TrimSpace(*sn.LinkUrl) != "" {
				href = sn.LinkUrl
			}
			items = append(items, TickerItem{Text: sn.Body, Href: href})
		}
	}
	if cfg.Source == "articles" || cfg.Source == "both" {
		rows, err := rc.q.ListBreakingPublished(ctx, int32(cfg.Limit))
		if err != nil {
			return nil, fmt.Errorf("homepage: breaking articles: %w", err)
		}
		for _, a := range rows {
			href := rc.cats.articleURL(a)
			items = append(items, TickerItem{Text: a.Title, Href: &href})
		}
	}
	if len(items) > cfg.Limit {
		items = items[:cfg.Limit]
	}
	return &BreakingTickerData{Items: items}, nil
}

// --- article_grid / timeline ---

func resolveArticleGrid(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg ArticleGridConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	return rc.articleList(ctx, cfg.CategorySlug, cfg.IncludeChildren, cfg.TagSlug, orderPublishedAt, cfg.Limit, cfg.DedupeOptions)
}

func resolveTimeline(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg TimelineConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	return rc.articleList(ctx, cfg.CategorySlug, true, "", cfg.OrderBy, cfg.Limit, cfg.DedupeOptions)
}

func (rc *resolveCtx) articleList(ctx context.Context, categorySlug string, includeChildren bool, tagSlug, orderBy string, limit int, d DedupeOptions) (*ArticleListData, error) {
	data := &ArticleListData{Items: []content.ArticleCard{}, pick: pickOpts{limit: limit, excludeHero: d.ExcludeHero, dedupe: d.Dedupe}}
	catIDs, tagID, ok, err := rc.articleFilter(ctx, categorySlug, includeChildren, tagSlug)
	if err != nil || !ok {
		return data, err
	}
	rows, err := rc.q.ListPublishedByCategoryOrdered(ctx, dbgen.ListPublishedByCategoryOrderedParams{
		CategoryIds: catIDs, TagID: tagID, ExcludeIds: rc.heroExclude(d.ExcludeHero),
		OrderBy: orderBy, Limit: fetchSize(limit, d.Dedupe),
	})
	if err != nil {
		return nil, fmt.Errorf("homepage: list articles: %w", err)
	}
	cards, err := rc.hyd.Cards(ctx, rows)
	if err != nil {
		return nil, err
	}
	data.cands = cards
	return data, nil
}

// --- latest_with_sidebar ---

func resolveLatestWithSidebar(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg LatestWithSidebarConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	list, err := rc.articleList(ctx, cfg.CategorySlug, true, "", orderPublishedAt, cfg.Limit, cfg.DedupeOptions)
	if err != nil {
		return nil, err
	}
	data := &LatestWithSidebarData{Items: list.Items, Widgets: map[string]any{}, cands: list.cands, pick: list.pick}
	for _, w := range cfg.Widgets {
		var v any
		var err error
		switch w {
		case WidgetPopular:
			v, err = rc.popularWidget(ctx, cfg.PopularDays, cfg.PopularLimit)
		case WidgetCategories:
			v, err = rc.categoriesWidget(ctx)
		case WidgetTags:
			v, err = rc.tagsWidget(ctx, cfg.TagsLimit)
		case WidgetNextEvent:
			v, err = rc.nextEventWidget(ctx)
		default:
			continue
		}
		if err != nil {
			return nil, err
		}
		data.Widgets[w] = v
	}
	return data, nil
}

func (rc *resolveCtx) popularWidget(ctx context.Context, days, limit int) ([]content.ArticleCard, error) {
	rows, err := rc.topViewed(ctx, days, limit, 0)
	if err != nil {
		return nil, err
	}
	return rc.hyd.Cards(ctx, rows)
}

func (rc *resolveCtx) categoriesWidget(ctx context.Context) ([]CategoryWidgetItem, error) {
	rows, err := rc.q.ListCategoriesWithCounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("homepage: categories with counts: %w", err)
	}
	roots := []CategoryWidgetItem{}
	rootIdx := map[int64]int{}
	for _, c := range rows { // roots come first (ORDER BY parent_id NULLS FIRST)
		if c.ParentID == nil && c.IsActive {
			rootIdx[c.ID] = len(roots)
			roots = append(roots, CategoryWidgetItem{Name: c.Name, Slug: c.Slug, URL: "/" + c.Slug, ArticleCount: c.ArticleCount})
		}
	}
	for _, c := range rows {
		if c.ParentID == nil || !c.IsActive {
			continue
		}
		i, ok := rootIdx[*c.ParentID]
		if !ok {
			continue
		}
		p := &roots[i]
		p.ArticleCount += c.ArticleCount
		p.Children = append(p.Children, CategoryWidgetItem{
			Name: c.Name, Slug: c.Slug, URL: "/" + p.Slug + "?sub=" + c.Slug, ArticleCount: c.ArticleCount,
		})
	}
	return roots, nil
}

func (rc *resolveCtx) tagsWidget(ctx context.Context, limit int) ([]TagWidgetItem, error) {
	rows, err := rc.q.ListPopularTags(ctx, int32(limit))
	if err != nil {
		return nil, fmt.Errorf("homepage: popular tags: %w", err)
	}
	out := make([]TagWidgetItem, 0, len(rows))
	for _, t := range rows {
		out = append(out, TagWidgetItem{Name: t.Name, Slug: t.Slug, URL: content.TagURL(t.Slug), ArticleCount: t.ArticleCount})
	}
	return out, nil
}

func (rc *resolveCtx) nextEventWidget(ctx context.Context) (*content.EventCard, error) {
	rows, err := rc.q.ListUpcomingEvents(ctx, 1)
	if err != nil {
		return nil, fmt.Errorf("homepage: next event: %w", err)
	}
	cards, err := rc.hyd.EventCards(ctx, rows)
	if err != nil || len(cards) == 0 {
		return nil, err
	}
	return &cards[0], nil
}

// --- feature_split ---

func resolveFeatureSplit(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg FeatureSplitConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	data := &FeatureSplitData{
		Items: []content.ArticleCard{}, sideLimit: cfg.SideLimit,
		pick: pickOpts{limit: cfg.SideLimit, excludeHero: cfg.ExcludeHero, dedupe: cfg.Dedupe},
	}
	catIDs, _, ok, err := rc.articleFilter(ctx, cfg.CategorySlug, true, "")
	if err != nil || !ok {
		return data, err
	}
	exclude := rc.heroExclude(cfg.ExcludeHero)
	featured, err := rc.q.ListFeaturedPublished(ctx, dbgen.ListFeaturedPublishedParams{
		CategoryIds: catIDs, ExcludeIds: exclude, Limit: fetchSize(1, cfg.Dedupe),
	})
	if err != nil {
		return nil, fmt.Errorf("homepage: featured articles: %w", err)
	}
	latest, err := rc.q.ListPublishedByCategoryOrdered(ctx, dbgen.ListPublishedByCategoryOrderedParams{
		CategoryIds: catIDs, ExcludeIds: exclude, OrderBy: orderPublishedAt, Limit: fetchSize(cfg.SideLimit+1, cfg.Dedupe),
	})
	if err != nil {
		return nil, fmt.Errorf("homepage: latest articles: %w", err)
	}
	cards, err := rc.hyd.Cards(ctx, append(featured, latest...))
	if err != nil {
		return nil, err
	}
	data.featuredCands = cards[:len(featured)]
	data.cands = cards[len(featured):]
	return data, nil
}
