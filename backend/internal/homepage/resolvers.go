package homepage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"golang.org/x/sync/errgroup"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
)

// resolverParallelism bounds concurrent section resolvers (each may hold a
// pool connection for a few queries).
const resolverParallelism = 6

// dedupeExtra is how many extra candidates a dedupe-enabled section fetches
// so it can still fill its limit after dropping already-shown articles.
const dedupeExtra = 8

// resolver fetches the data of one section type from its normalized config.
// empty returns the value used when the resolver fails.
type resolver struct {
	resolve func(ctx context.Context, rc *resolveCtx, cfg json.RawMessage) (any, error)
	empty   func() any
}

var resolvers = map[string]resolver{
	TypeHeroTrending:      {resolveHeroTrending, func() any { return &HeroTrendingData{Trending: []content.ArticleCard{}} }},
	TypeBreakingTicker:    {resolveBreakingTicker, func() any { return &BreakingTickerData{Items: []TickerItem{}} }},
	TypeArticleGrid:       {resolveArticleGrid, emptyArticleList},
	TypeLatestWithSidebar: {resolveLatestWithSidebar, func() any { return &LatestWithSidebarData{Items: []content.ArticleCard{}, Widgets: map[string]any{}} }},
	TypeQuoteRotator:      {resolveQuoteRotator, func() any { return &QuoteRotatorData{Quotes: []Quote{}} }},
	TypeTimeline:          {resolveTimeline, emptyArticleList},
	TypeFeatureSplit:      {resolveFeatureSplit, func() any { return &FeatureSplitData{Items: []content.ArticleCard{}} }},
	TypePeopleGrid:        {resolvePeopleGrid, func() any { return &PeopleGridData{Items: []content.AlumniCard{}} }},
	TypeAgendaCalendar:    {resolveAgendaCalendar, func() any { return &AgendaCalendarData{Items: []content.EventCard{}} }},
	TypeVideoGallery:      {resolveVideoGallery, func() any { return &VideoGalleryData{Items: []content.VideoCard{}} }},
	TypeFAQ:               {resolveFAQ, func() any { return &FAQData{Items: []FAQItem{}} }},
	TypeNewsletter:        {resolveNewsletter, func() any { return &NewsletterData{} }},
	TypeRichText:          {resolveRichText, func() any { return &RichTextData{} }},
}

func emptyArticleList() any { return &ArticleListData{Items: []content.ArticleCard{}} }

// resolveCtx is shared (read-only after the hero phase) by all resolvers of
// one Resolve call.
type resolveCtx struct {
	q      *dbgen.Queries
	hyd    *content.Hydrator
	now    time.Time
	cats   *catIndex
	heroID int64 // 0 = no hero
}

// heroExclude returns the SQL exclude list for sections with exclude_hero.
func (rc *resolveCtx) heroExclude(excludeHero bool) []int64 {
	if excludeHero && rc.heroID != 0 {
		return []int64{rc.heroID}
	}
	return nil
}

// catIndex indexes categories for slug → id-set lookups.
type catIndex struct {
	bySlug   map[string]dbgen.Category
	children map[int64][]dbgen.Category
	refs     map[int64]content.CategoryRef
	rows     []dbgen.Category
}

func newCatIndex(rows []dbgen.Category) *catIndex {
	c := &catIndex{
		bySlug:   make(map[string]dbgen.Category, len(rows)),
		children: map[int64][]dbgen.Category{},
		refs:     content.CategoryRefsFrom(rows),
		rows:     rows,
	}
	for _, r := range rows {
		c.bySlug[r.Slug] = r
		if r.ParentID != nil {
			c.children[*r.ParentID] = append(c.children[*r.ParentID], r)
		}
	}
	return c
}

// ids returns the category id (plus active children when includeChildren)
// for slug; ok is false when the slug is unknown or inactive.
func (c *catIndex) ids(slug string, includeChildren bool) ([]int64, bool) {
	cat, found := c.bySlug[slug]
	if !found || !cat.IsActive {
		return nil, false
	}
	out := []int64{cat.ID}
	if includeChildren {
		for _, ch := range c.children[cat.ID] {
			if ch.IsActive {
				out = append(out, ch.ID)
			}
		}
	}
	return out, true
}

// articleURL computes the public URL of an article row.
func (c *catIndex) articleURL(a dbgen.Article) string {
	return content.ArticleURL(c.refs[a.CategoryID].Level1Slug(), a.Slug)
}

// --- dedupe ---

// pickOpts controls how a section selects its final articles from candidates.
type pickOpts struct {
	limit       int
	excludeHero bool
	dedupe      bool
}

// seenSet tracks article ids already shown, in position order.
type seenSet struct {
	hero int64
	ids  map[int64]bool
}

func newSeenSet(hero int64) *seenSet { return &seenSet{hero: hero, ids: map[int64]bool{}} }

func (s *seenSet) add(cards ...content.ArticleCard) {
	for _, c := range cards {
		s.ids[c.ID] = true
	}
}

// pick returns up to n candidates, skipping skipID, the hero (excludeHero)
// and already-seen ids (dedupe). Never nil.
func (p pickOpts) pick(cands []content.ArticleCard, s *seenSet, n int, skipID int64) []content.ArticleCard {
	out := make([]content.ArticleCard, 0, n)
	for _, c := range cands {
		if len(out) >= n {
			break
		}
		if (skipID != 0 && c.ID == skipID) ||
			(p.excludeHero && s.hero != 0 && c.ID == s.hero) ||
			(p.dedupe && s.ids[c.ID]) {
			continue
		}
		out = append(out, c)
	}
	return out
}

// finalizer is implemented by data types that pick their final articles in
// the sequential post-pass (position order).
type finalizer interface {
	finalize(s *seenSet)
}

func (d *HeroTrendingData) finalize(s *seenSet) {
	if d.Hero != nil {
		s.add(*d.Hero)
	}
	s.add(d.Trending...)
}

func (d *ArticleListData) finalize(s *seenSet) {
	d.Items = d.pick.pick(d.cands, s, d.pick.limit, 0)
	s.add(d.Items...)
}

func (d *LatestWithSidebarData) finalize(s *seenSet) {
	d.Items = d.pick.pick(d.cands, s, d.pick.limit, 0)
	s.add(d.Items...)
}

func (d *FeatureSplitData) finalize(s *seenSet) {
	d.Featured = nil
	if f := d.pick.pick(d.featuredCands, s, 1, 0); len(f) == 1 {
		d.Featured = &f[0]
	} else if f := d.pick.pick(d.cands, s, 1, 0); len(f) == 1 {
		d.Featured = &f[0]
	}
	var skip int64
	if d.Featured != nil {
		skip = d.Featured.ID
		s.add(*d.Featured)
	}
	d.Items = d.pick.pick(d.cands, s, d.sideLimit, skip)
	s.add(d.Items...)
}

// --- orchestration ---

type pendingSection struct {
	row  dbgen.HomepageSection
	cfg  json.RawMessage
	data any
}

// Resolve returns every active section of pageKey (position order) with its
// data. Sections with an invalid stored config are logged and skipped; a
// failing resolver is logged and yields that type's empty data. The first
// hero_trending section is resolved first so exclude_hero sections can skip
// its article; the others run in parallel, then dedupe is applied
// sequentially in position order.
func (s *Service) Resolve(ctx context.Context, pageKey string) ([]ResolvedSection, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListActiveHomepageSections(ctx, pageKey)
	if err != nil {
		return nil, fmt.Errorf("homepage: list active sections: %w", err)
	}
	items := make([]pendingSection, 0, len(rows))
	for _, row := range rows {
		if _, ok := resolvers[row.Type]; !ok {
			s.log.WarnContext(ctx, "homepage: unknown section type skipped", "section_id", row.ID, "type", row.Type)
			continue
		}
		cfg, err := s.reg.Normalize(row.Type, row.Config)
		if err != nil {
			s.log.WarnContext(ctx, "homepage: invalid section config skipped", "section_id", row.ID, "type", row.Type, "error", err)
			continue
		}
		items = append(items, pendingSection{row: row, cfg: cfg})
	}

	cats, err := q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("homepage: list categories: %w", err)
	}
	rc := &resolveCtx{q: q, hyd: content.NewHydrator(s.pool), now: s.now(), cats: newCatIndex(cats)}

	heroIdx := -1
	for i := range items {
		if items[i].row.Type == TypeHeroTrending {
			heroIdx = i
			break
		}
	}
	if heroIdx >= 0 {
		items[heroIdx].data = s.runResolver(ctx, rc, items[heroIdx])
		if hd, ok := items[heroIdx].data.(*HeroTrendingData); ok && hd.Hero != nil {
			rc.heroID = hd.Hero.ID
		}
	}

	var g errgroup.Group
	g.SetLimit(resolverParallelism)
	for i := range items {
		if i == heroIdx {
			continue
		}
		i := i
		g.Go(func() error {
			items[i].data = s.runResolver(ctx, rc, items[i])
			return nil
		})
	}
	_ = g.Wait() // resolvers never return errors; failures become empty data

	seen := newSeenSet(rc.heroID)
	out := make([]ResolvedSection, 0, len(items))
	for _, it := range items {
		if f, ok := it.data.(finalizer); ok {
			f.finalize(seen)
		}
		out = append(out, ResolvedSection{ID: it.row.ID, Type: it.row.Type, Config: it.cfg, Data: it.data})
	}
	return out, nil
}

// runResolver runs one resolver, converting errors and panics into the
// type's empty data.
func (s *Service) runResolver(ctx context.Context, rc *resolveCtx, it pendingSection) (data any) {
	r := resolvers[it.row.Type]
	defer func() {
		if p := recover(); p != nil {
			s.log.ErrorContext(ctx, "homepage: resolver panic", "section_id", it.row.ID, "type", it.row.Type, "panic", fmt.Sprint(p))
			data = r.empty()
		}
	}()
	d, err := r.resolve(ctx, rc, it.cfg)
	if err != nil {
		s.log.ErrorContext(ctx, "homepage: resolver failed", "section_id", it.row.ID, "type", it.row.Type, "error", err)
		return r.empty()
	}
	return d
}
