package homepage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/richtext"
)

func (rc *resolveCtx) snippets(ctx context.Context, typ string) ([]dbgen.Snippet, error) {
	rows, err := rc.q.ListActiveSnippets(ctx, dbgen.ListActiveSnippetsParams{Type: &typ, Now: rc.now})
	if err != nil {
		return nil, fmt.Errorf("homepage: %s snippets: %w", typ, err)
	}
	return rows, nil
}

func resolveQuoteRotator(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg QuoteRotatorConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	rows, err := rc.snippets(ctx, "quote")
	if err != nil {
		return nil, err
	}
	quotes := make([]Quote, 0, len(rows))
	for _, sn := range rows {
		quotes = append(quotes, Quote{Text: sn.Body, Source: sn.Source})
	}
	return &QuoteRotatorData{Quotes: quotes}, nil
}

func resolvePeopleGrid(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg PeopleGridConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	var featured *bool
	if cfg.OnlyFeatured {
		t := true
		featured = &t
	}
	rows, err := rc.q.ListPublishedAlumni(ctx, dbgen.ListPublishedAlumniParams{Featured: featured, Limit: int32(cfg.Limit)})
	if err != nil {
		return nil, fmt.Errorf("homepage: list alumni: %w", err)
	}
	cards, err := rc.hyd.AlumniCards(ctx, rows)
	if err != nil {
		return nil, err
	}
	return &PeopleGridData{Items: cards}, nil
}

func resolveAgendaCalendar(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg AgendaCalendarConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	rows, err := rc.q.ListUpcomingEvents(ctx, int32(cfg.Limit))
	if err != nil {
		return nil, fmt.Errorf("homepage: upcoming events: %w", err)
	}
	cards, err := rc.hyd.EventCards(ctx, rows)
	if err != nil {
		return nil, err
	}
	data := &AgendaCalendarData{Items: cards}
	if !cfg.ShowCalendar {
		return data, nil
	}
	base := rc.now.In(httpx.Jakarta)
	var nextID int64
	if len(rows) > 0 {
		nextID = rows[0].ID
		if cfg.CalendarMonth == "next_event" {
			base = rows[0].StartsAt.In(httpx.Jakarta)
		}
	}
	from := time.Date(base.Year(), base.Month(), 1, 0, 0, 0, 0, httpx.Jakarta)
	to := from.AddDate(0, 1, 0)
	monthRows, err := rc.q.ListPublishedEventsBetween(ctx, dbgen.ListPublishedEventsBetweenParams{FromTs: from, ToTs: to})
	if err != nil {
		return nil, fmt.Errorf("homepage: calendar events: %w", err)
	}
	// "current" with an empty grid but upcoming events elsewhere: show the next
	// event's month instead of a blank calendar (docs/06 §3).
	if cfg.CalendarMonth == "current" && len(monthRows) == 0 && len(rows) > 0 {
		base = rows[0].StartsAt.In(httpx.Jakarta)
		from = time.Date(base.Year(), base.Month(), 1, 0, 0, 0, 0, httpx.Jakarta)
		to = from.AddDate(0, 1, 0)
		monthRows, err = rc.q.ListPublishedEventsBetween(ctx, dbgen.ListPublishedEventsBetweenParams{FromTs: from, ToTs: to})
		if err != nil {
			return nil, fmt.Errorf("homepage: calendar events (fallback): %w", err)
		}
	}
	cal := &Calendar{Month: from.Format("2006-01"), DaysWithEvents: make([]CalendarDay, 0, len(monthRows))}
	for _, e := range monthRows {
		cal.DaysWithEvents = append(cal.DaysWithEvents, CalendarDay{
			Day: e.StartsAt.In(httpx.Jakarta).Day(), Slug: e.Slug, IsNext: e.ID == nextID,
		})
	}
	data.Calendar = cal
	return data, nil
}

func resolveVideoGallery(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg VideoGalleryConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	rows, err := rc.q.ListPublishedVideos(ctx, dbgen.ListPublishedVideosParams{Limit: int32(cfg.Limit)})
	if err != nil {
		return nil, fmt.Errorf("homepage: list videos: %w", err)
	}
	cards, err := rc.hyd.VideoCards(ctx, rows)
	if err != nil {
		return nil, err
	}
	return &VideoGalleryData{Items: cards}, nil
}

func resolveFAQ(ctx context.Context, rc *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg FAQConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	rows, err := rc.snippets(ctx, "faq")
	if err != nil {
		return nil, err
	}
	items := make([]FAQItem, 0, len(rows))
	for _, sn := range rows {
		if cfg.Limit != nil && len(items) >= *cfg.Limit {
			break
		}
		if sn.Title == nil || strings.TrimSpace(*sn.Title) == "" {
			continue
		}
		items = append(items, FAQItem{Question: *sn.Title, AnswerHTML: richtext.SanitizeInline(sn.Body)})
	}
	return &FAQData{Items: items}, nil
}

func resolveNewsletter(_ context.Context, _ *resolveCtx, _ json.RawMessage) (any, error) {
	return &NewsletterData{}, nil
}

func resolveRichText(_ context.Context, _ *resolveCtx, raw json.RawMessage) (any, error) {
	var cfg RichTextConfig
	if err := decodeConfig(raw, &cfg); err != nil {
		return nil, err
	}
	// Sanitized at save time; sanitizing again guards rows written outside the API.
	return &RichTextData{ContentHTML: richtext.Sanitize(cfg.ContentHTML)}, nil
}
