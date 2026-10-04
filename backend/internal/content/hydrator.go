package content

import (
	"context"
	"fmt"

	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// Hydrator turns rows into cards using batched lookups. It accepts any
// dbgen.DBTX, so it can run inside a transaction.
type Hydrator struct {
	q *dbgen.Queries
}

// NewHydrator returns a Hydrator over db (pool or tx).
func NewHydrator(db dbgen.DBTX) *Hydrator { return &Hydrator{q: dbgen.New(db)} }

// Media loads media by id (duplicates and zero ids ignored). Missing ids are
// absent from the map.
func (h *Hydrator) Media(ctx context.Context, ids []int64) (map[int64]Media, error) {
	ids = uniqueIDs(ids)
	out := make(map[int64]Media, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := h.q.ListMediaByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("content: list media: %w", err)
	}
	for _, m := range rows {
		out[m.ID] = MediaFromRow(m)
	}
	return out, nil
}

// Categories loads every category as id -> CategoryRef.
func (h *Hydrator) Categories(ctx context.Context) (map[int64]CategoryRef, error) {
	rows, err := h.q.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("content: list categories: %w", err)
	}
	return CategoryRefsFrom(rows), nil
}

// Cards hydrates article rows into cards, preserving row order. It runs at
// most three queries (categories, authors, media) and never returns a nil
// slice.
func (h *Hydrator) Cards(ctx context.Context, rows []dbgen.Article) ([]ArticleCard, error) {
	out := make([]ArticleCard, 0, len(rows))
	if len(rows) == 0 {
		return out, nil
	}
	cats, err := h.Categories(ctx)
	if err != nil {
		return nil, err
	}
	authorIDs := make([]int64, 0, len(rows))
	mediaIDs := make([]int64, 0, len(rows)*2)
	for _, a := range rows {
		authorIDs = append(authorIDs, a.AuthorID)
		if a.CoverMediaID != nil {
			mediaIDs = append(mediaIDs, *a.CoverMediaID)
		}
	}
	users, err := h.q.ListUsersByIDs(ctx, uniqueIDs(authorIDs))
	if err != nil {
		return nil, fmt.Errorf("content: list authors: %w", err)
	}
	authors := make(map[int64]dbgen.ListUsersByIDsRow, len(users))
	for _, u := range users {
		authors[u.ID] = u
		if u.AvatarMediaID != nil {
			mediaIDs = append(mediaIDs, *u.AvatarMediaID)
		}
	}
	media, err := h.Media(ctx, mediaIDs)
	if err != nil {
		return nil, err
	}
	for _, a := range rows {
		out = append(out, buildCard(a, cats, authors, media))
	}
	return out, nil
}

// Card hydrates a single article row.
func (h *Hydrator) Card(ctx context.Context, row dbgen.Article) (ArticleCard, error) {
	cards, err := h.Cards(ctx, []dbgen.Article{row})
	if err != nil {
		return ArticleCard{}, err
	}
	return cards[0], nil
}

func buildCard(a dbgen.Article, cats map[int64]CategoryRef, authors map[int64]dbgen.ListUsersByIDsRow, media map[int64]Media) ArticleCard {
	cat, ok := cats[a.CategoryID]
	if !ok {
		cat = CategoryRef{ID: a.CategoryID}
	}
	author := AuthorRef{ID: a.AuthorID}
	if u, ok := authors[a.AuthorID]; ok {
		author = AuthorRef{ID: u.ID, DisplayName: u.DisplayName, Slug: u.Slug, Title: u.Title, Avatar: mediaPtr(media, u.AvatarMediaID)}
	}
	return ArticleCard{
		ID:             a.ID,
		Slug:           a.Slug,
		Title:          a.Title,
		Excerpt:        a.Excerpt,
		URL:            ArticleURL(cat.Level1Slug(), a.Slug),
		Cover:          mediaPtr(media, a.CoverMediaID),
		Category:       cat,
		Author:         author,
		PublishedAt:    httpx.FormatTimePtr(a.PublishedAt),
		ReadingMinutes: a.ReadingMinutes,
		EventDate:      httpx.FormatDatePtr(a.EventDate),
		EventLocation:  a.EventLocation,
		IsFeatured:     a.IsFeatured,
		IsBreaking:     a.IsBreaking,
		ViewCount:      a.ViewCount,
	}
}

// EventCards hydrates event rows (one media query), preserving order.
func (h *Hydrator) EventCards(ctx context.Context, rows []dbgen.Event) ([]EventCard, error) {
	out := make([]EventCard, 0, len(rows))
	ids := make([]int64, 0, len(rows))
	for _, e := range rows {
		if e.CoverMediaID != nil {
			ids = append(ids, *e.CoverMediaID)
		}
	}
	media, err := h.Media(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, e := range rows {
		out = append(out, EventCard{
			ID:           e.ID,
			Slug:         e.Slug,
			Title:        e.Title,
			Summary:      e.Summary,
			StartsAt:     httpx.FormatTime(e.StartsAt),
			EndsAt:       httpx.FormatTimePtr(e.EndsAt),
			IsAllDay:     e.IsAllDay,
			LocationName: e.LocationName,
			Cover:        mediaPtr(media, e.CoverMediaID),
			URL:          EventURL(e.Slug),
		})
	}
	return out, nil
}

// AlumniCards hydrates alumni rows (one media query), preserving order.
func (h *Hydrator) AlumniCards(ctx context.Context, rows []dbgen.AlumniProfile) ([]AlumniCard, error) {
	out := make([]AlumniCard, 0, len(rows))
	ids := make([]int64, 0, len(rows))
	for _, a := range rows {
		if a.PhotoMediaID != nil {
			ids = append(ids, *a.PhotoMediaID)
		}
	}
	media, err := h.Media(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, a := range rows {
		out = append(out, AlumniCard{
			ID:        a.ID,
			Slug:      a.Slug,
			Name:      a.Name,
			RoleTitle: a.RoleTitle,
			ClassYear: a.ClassYear,
			ShortBio:  a.ShortBio,
			Photo:     mediaPtr(media, a.PhotoMediaID),
			URL:       AlumniURL(a.Slug),
		})
	}
	return out, nil
}

// VideoCards hydrates video rows (one media query), preserving order. The
// thumbnail falls back to the YouTube default image.
func (h *Hydrator) VideoCards(ctx context.Context, rows []dbgen.Video) ([]VideoCard, error) {
	out := make([]VideoCard, 0, len(rows))
	ids := make([]int64, 0, len(rows))
	for _, v := range rows {
		if v.ThumbnailMediaID != nil {
			ids = append(ids, *v.ThumbnailMediaID)
		}
	}
	media, err := h.Media(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, v := range rows {
		thumb := YouTubeThumbnailURL(v.YoutubeID)
		if m := mediaPtr(media, v.ThumbnailMediaID); m != nil {
			thumb = m.URL
		}
		out = append(out, VideoCard{
			ID:              v.ID,
			Slug:            v.Slug,
			Title:           v.Title,
			YoutubeID:       v.YoutubeID,
			ThumbnailURL:    thumb,
			DurationSeconds: v.DurationSeconds,
			ViewCount:       v.ViewCount,
			PublishedAt:     httpx.FormatTime(v.PublishedAt),
			IsFeatured:      v.IsFeatured,
			URL:             VideoURL(v.Slug),
		})
	}
	return out, nil
}

func mediaPtr(media map[int64]Media, id *int64) *Media {
	if id == nil {
		return nil
	}
	m, ok := media[*id]
	if !ok {
		return nil
	}
	return &m
}

func uniqueIDs(ids []int64) []int64 {
	seen := make(map[int64]struct{}, len(ids))
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
