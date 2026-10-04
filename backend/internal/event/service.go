package event

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/richtext"
	"portal-berita/backend/internal/slugutil"
)

// Service implements event (agenda) CRUD and public listing.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns an event Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns the admin listing.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Item, int64, error) {
	q := dbgen.New(s.pool)
	params := dbgen.ListEventsAdminParams{
		Q: nullStr(f.Q), Status: nullStr(f.Status),
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	}
	rows, err := q.ListEventsAdmin(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("event: list: %w", err)
	}
	total, err := q.CountEventsAdmin(ctx, dbgen.CountEventsAdminParams{Q: params.Q, Status: params.Status})
	if err != nil {
		return nil, 0, fmt.Errorf("event: count: %w", err)
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(r)
	}
	return items, total, nil
}

// Get returns one event by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	row, err := dbgen.New(s.pool).GetEvent(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("event: get: %w", err)
	}
	item := itemFromRow(row)
	return &item, nil
}

// Create inserts a new event.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in Input) (*Item, error) {
	start, end, err := parseWindow(in.StartsAt, in.EndsAt)
	if err != nil {
		return nil, err
	}
	status := in.Status
	if status == "" {
		status = content.StatusDraft
	}
	html := richtext.Sanitize(in.DescriptionHTML)

	var out *Item
	var slug string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		slug, err = uniqueSlug(ctx, q, in.Title, in.Slug, 0)
		if err != nil {
			return err
		}
		created, err := q.CreateEvent(ctx, dbgen.CreateEventParams{
			Title: in.Title, Slug: slug, Summary: in.Summary,
			DescriptionJson: nilIfEmpty(in.DescriptionJSON), DescriptionHtml: nullStr(html),
			StartsAt: start, EndsAt: end, IsAllDay: in.IsAllDay,
			LocationName: in.LocationName, LocationAddress: in.LocationAddress, MapsUrl: in.MapsURL,
			CoverMediaID: in.CoverMediaID, RegistrationUrl: in.RegistrationURL, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription,
			CreatedBy: meta.UserID, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityEvent,
			EntityID: &created.ID, Summary: "Agenda dibuat: " + created.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("event: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Event(slug), revalidate.TagEvents, revalidate.TagHomepage, revalidate.TagSitemap)
	return out, nil
}

// Update replaces an event.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in Input) (*Item, error) {
	start, end, err := parseWindow(in.StartsAt, in.EndsAt)
	if err != nil {
		return nil, err
	}
	html := richtext.Sanitize(in.DescriptionHTML)

	var out *Item
	var oldSlug, newSlug string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetEvent(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("event: get for update: %w", err)
		}
		oldSlug = existing.Slug
		status := in.Status
		if status == "" {
			status = existing.Status
		}
		newSlug, err = uniqueSlug(ctx, q, in.Title, in.Slug, id)
		if err != nil {
			return err
		}
		updated, err := q.UpdateEvent(ctx, dbgen.UpdateEventParams{
			ID: id, Title: in.Title, Slug: newSlug, Summary: in.Summary,
			DescriptionJson: nilIfEmpty(in.DescriptionJSON), DescriptionHtml: nullStr(html),
			StartsAt: start, EndsAt: end, IsAllDay: in.IsAllDay,
			LocationName: in.LocationName, LocationAddress: in.LocationAddress, MapsUrl: in.MapsURL,
			CoverMediaID: in.CoverMediaID, RegistrationUrl: in.RegistrationURL, Status: status,
			SeoTitle: in.SEOTitle, SeoDescription: in.SEODescription, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityEvent,
			EntityID: &id, Summary: "Agenda diperbarui: " + updated.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("event: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Event(newSlug), revalidate.TagEvents, revalidate.TagHomepage, revalidate.TagSitemap}
	if oldSlug != newSlug {
		tags = append(tags, revalidate.Event(oldSlug))
	}
	s.reval.Enqueue(tags...)
	return out, nil
}

// Delete removes an event.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetEvent(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("event: get for delete: %w", err)
		}
		slug = existing.Slug
		rows, err := q.DeleteEvent(ctx, id)
		if err != nil {
			return fmt.Errorf("event: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityEvent,
			EntityID: &id, Summary: "Agenda dihapus: " + existing.Title, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Event(slug), revalidate.TagEvents, revalidate.TagHomepage, revalidate.TagSitemap)
	return nil
}

// ListPublic returns published events matching f.
func (s *Service) ListPublic(ctx context.Context, f PublicFilter) ([]content.EventCard, int64, error) {
	q := dbgen.New(s.pool)
	when := f.When
	params := dbgen.ListPublishedEventsParams{
		When: when, MonthFrom: f.MonthFrom, MonthTo: f.MonthTo,
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	}
	rows, err := q.ListPublishedEvents(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("event: list public: %w", err)
	}
	total, err := q.CountPublishedEvents(ctx, dbgen.CountPublishedEventsParams{
		When: when, MonthFrom: f.MonthFrom, MonthTo: f.MonthTo,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("event: count public: %w", err)
	}
	cards, err := content.NewHydrator(s.pool).EventCards(ctx, rows)
	if err != nil {
		return nil, 0, fmt.Errorf("event: hydrate: %w", err)
	}
	return cards, total, nil
}

// GetPublic returns the public detail of a published event.
func (s *Service) GetPublic(ctx context.Context, slug string) (*PublicDetail, error) {
	row, err := dbgen.New(s.pool).GetPublishedEventBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("event: get public: %w", err)
	}
	var cover *content.Media
	if row.CoverMediaID != nil {
		media, err := content.NewHydrator(s.pool).Media(ctx, []int64{*row.CoverMediaID})
		if err != nil {
			return nil, fmt.Errorf("event: hydrate cover: %w", err)
		}
		if m, ok := media[*row.CoverMediaID]; ok {
			cover = &m
		}
	}
	desc := ""
	if row.DescriptionHtml != nil {
		desc = *row.DescriptionHtml
	}
	return &PublicDetail{
		ID: row.ID, Slug: row.Slug, Title: row.Title, Summary: row.Summary,
		URL: content.EventURL(row.Slug), StartsAt: httpx.FormatTime(row.StartsAt), EndsAt: httpx.FormatTimePtr(row.EndsAt),
		IsAllDay: row.IsAllDay, LocationName: row.LocationName, LocationAddress: row.LocationAddress,
		MapsURL: row.MapsUrl, Cover: cover, RegistrationURL: row.RegistrationUrl,
		DescriptionHTML: desc, Status: row.Status,
		SEO: SEO{Title: row.SeoTitle, Description: row.SeoDescription},
	}, nil
}

func itemFromRow(r dbgen.Event) Item {
	return Item{
		ID: r.ID, Title: r.Title, Slug: r.Slug, Summary: r.Summary,
		DescriptionJSON: rawOrNil(r.DescriptionJson), DescriptionHTML: strOrEmpty(r.DescriptionHtml),
		StartsAt: httpx.FormatTime(r.StartsAt), EndsAt: httpx.FormatTimePtr(r.EndsAt), IsAllDay: r.IsAllDay,
		LocationName: r.LocationName, LocationAddress: r.LocationAddress, MapsURL: r.MapsUrl,
		CoverMediaID: r.CoverMediaID, RegistrationURL: r.RegistrationUrl, Status: r.Status,
		SEO:       SEO{Title: r.SeoTitle, Description: r.SeoDescription},
		CreatedAt: httpx.FormatTime(r.CreatedAt), UpdatedAt: httpx.FormatTime(r.UpdatedAt),
	}
}

// uniqueSlug derives a slug from title/want, appending a numeric suffix on
// conflict. excludeID = 0 on create.
func uniqueSlug(ctx context.Context, q *dbgen.Queries, title, want string, excludeID int64) (string, error) {
	if want != "" {
		if !slugutil.Valid(want) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		exists, err := q.EventSlugExists(ctx, dbgen.EventSlugExistsParams{Slug: want, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("event: slug exists: %w", err)
		}
		if exists {
			return "", apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
		}
		return want, nil
	}
	base := slugutil.Make(title)
	if base == "" {
		base = "agenda"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := q.EventSlugExists(ctx, dbgen.EventSlugExistsParams{Slug: slug, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("event: slug exists: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

func parseWindow(startsAt string, endsAt *string) (time.Time, *time.Time, error) {
	start, err := time.Parse(time.RFC3339, startsAt)
	if err != nil {
		return time.Time{}, nil, apperr.Validation(map[string]string{"starts_at": "Format tanggal tidak valid."})
	}
	var end *time.Time
	if endsAt != nil && *endsAt != "" {
		e, err := time.Parse(time.RFC3339, *endsAt)
		if err != nil {
			return time.Time{}, nil, apperr.Validation(map[string]string{"ends_at": "Format tanggal tidak valid."})
		}
		if e.Before(start) {
			return time.Time{}, nil, apperr.Validation(map[string]string{"ends_at": "Waktu selesai harus setelah waktu mulai."})
		}
		end = &e
	}
	return start, end, nil
}

func mapWriteError(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok && constraint == "events_slug_key" {
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
	if constraint, ok := database.ForeignKeyViolation(err); ok && constraint == "events_cover_media_id_fkey" {
		return apperr.Validation(map[string]string{"cover_media_id": "Media tidak ditemukan."})
	}
	if _, ok := database.CheckViolation(err); ok {
		return apperr.Validation(map[string]string{"ends_at": "Waktu selesai harus setelah waktu mulai."})
	}
	return fmt.Errorf("event: write: %w", err)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func rawOrNil(b []byte) json.RawMessage {
	if len(b) == 0 {
		return nil
	}
	return json.RawMessage(b)
}

func nilIfEmpty(b json.RawMessage) []byte {
	if len(b) == 0 {
		return nil
	}
	return []byte(b)
}
