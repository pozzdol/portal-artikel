package snippet

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/richtext"
)

// Service implements snippet CRUD, public listing and the window-transition
// job (§1.7 "snippet.window_transitions").
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client

	mu       sync.Mutex
	lastTick time.Time
}

// NewService returns a snippet Service. lastTick starts one minute before
// now so the first job tick only picks up transitions since startup.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval, lastTick: time.Now().Add(-time.Minute)}
}

// List returns the admin listing, optionally filtered by type.
func (s *Service) List(ctx context.Context, typ string) ([]Item, error) {
	rows, err := dbgen.New(s.pool).ListSnippetsAdmin(ctx, nullStr(typ))
	if err != nil {
		return nil, fmt.Errorf("snippet: list: %w", err)
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(r)
	}
	return items, nil
}

// Get returns one snippet by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	row, err := dbgen.New(s.pool).GetSnippet(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("snippet: get: %w", err)
	}
	item := itemFromRow(row)
	return &item, nil
}

// Create inserts a new snippet.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in Input) (*Item, error) {
	starts, ends, err := parseWindow(in.StartsAt, in.EndsAt)
	if err != nil {
		return nil, err
	}
	if err := validateFAQTitle(in.Type, in.Title); err != nil {
		return nil, err
	}
	body := richtext.SanitizeInline(in.Body)

	var out *Item
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		created, err := q.CreateSnippet(ctx, dbgen.CreateSnippetParams{
			Type: in.Type, Title: in.Title, Body: body, Source: in.Source, LinkUrl: in.LinkURL,
			SortOrder: in.SortOrder, IsActive: in.IsActive, StartsAt: starts, EndsAt: ends,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntitySnippet,
			EntityID: &created.ID, Summary: "Snippet dibuat (" + created.Type + ").", IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("snippet: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.TagSnippets, revalidate.TagHomepage)
	return out, nil
}

// Update replaces a snippet.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in Input) (*Item, error) {
	starts, ends, err := parseWindow(in.StartsAt, in.EndsAt)
	if err != nil {
		return nil, err
	}
	if err := validateFAQTitle(in.Type, in.Title); err != nil {
		return nil, err
	}
	body := richtext.SanitizeInline(in.Body)

	var out *Item
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if _, err := q.GetSnippet(ctx, id); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("snippet: get for update: %w", err)
		}
		updated, err := q.UpdateSnippet(ctx, dbgen.UpdateSnippetParams{
			ID: id, Type: in.Type, Title: in.Title, Body: body, Source: in.Source, LinkUrl: in.LinkURL,
			SortOrder: in.SortOrder, IsActive: in.IsActive, StartsAt: starts, EndsAt: ends,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntitySnippet,
			EntityID: &id, Summary: "Snippet diperbarui (" + updated.Type + ").", IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("snippet: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.TagSnippets, revalidate.TagHomepage)
	return out, nil
}

// Delete removes a snippet.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetSnippet(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("snippet: get for delete: %w", err)
		}
		rows, err := q.DeleteSnippet(ctx, id)
		if err != nil {
			return fmt.Errorf("snippet: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntitySnippet,
			EntityID: &id, Summary: "Snippet dihapus (" + existing.Type + ").", IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.TagSnippets, revalidate.TagHomepage)
	return nil
}

// Reorder updates sort_order for the given ids in one transaction. Any
// unknown id is reported as apperr.NotFound before anything is written.
func (s *Service) Reorder(ctx context.Context, meta audit.Meta, items []ReorderItem) error {
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		for _, it := range items {
			if _, err := q.GetSnippet(ctx, it.ID); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return apperr.NotFound()
				}
				return fmt.Errorf("snippet: get for reorder: %w", err)
			}
		}
		for _, it := range items {
			if err := q.UpdateSnippetOrder(ctx, dbgen.UpdateSnippetOrderParams{ID: it.ID, SortOrder: it.SortOrder}); err != nil {
				return fmt.Errorf("snippet: reorder: %w", err)
			}
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionReorder, EntityType: audit.EntitySnippet,
			Summary: "Urutan snippet diubah.", IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.TagSnippets, revalidate.TagHomepage)
	return nil
}

// ListPublic returns active snippets, optionally filtered by type.
func (s *Service) ListPublic(ctx context.Context, typ string) ([]PublicItem, error) {
	rows, err := dbgen.New(s.pool).ListActiveSnippets(ctx, dbgen.ListActiveSnippetsParams{
		Type: nullStr(typ), Now: time.Now(),
	})
	if err != nil {
		return nil, fmt.Errorf("snippet: list public: %w", err)
	}
	items := make([]PublicItem, len(rows))
	for i, r := range rows {
		items[i] = PublicItem{ID: r.ID, Type: r.Type, Title: r.Title, Body: r.Body, Source: r.Source, LinkURL: r.LinkUrl}
	}
	return items, nil
}

// WindowTransitions counts snippets whose active window opened or closed
// since the last call and, if any did, enqueues the snippets/homepage tags.
// It is registered as the "snippet.window_transitions" job (§1.7).
func (s *Service) WindowTransitions(ctx context.Context) (int64, error) {
	s.mu.Lock()
	since := s.lastTick
	now := time.Now()
	s.mu.Unlock()

	n, err := dbgen.New(s.pool).CountSnippetTransitions(ctx, dbgen.CountSnippetTransitionsParams{Since: since, Now: now})
	if err != nil {
		return 0, fmt.Errorf("snippet: count transitions: %w", err)
	}

	s.mu.Lock()
	s.lastTick = now
	s.mu.Unlock()

	if n > 0 {
		s.reval.Enqueue(revalidate.TagSnippets, revalidate.TagHomepage)
	}
	return n, nil
}

func itemFromRow(r dbgen.Snippet) Item {
	return Item{
		ID: r.ID, Type: r.Type, Title: r.Title, Body: r.Body, Source: r.Source, LinkURL: r.LinkUrl,
		SortOrder: r.SortOrder, IsActive: r.IsActive,
		StartsAt: httpx.FormatTimePtr(r.StartsAt), EndsAt: httpx.FormatTimePtr(r.EndsAt),
		CreatedAt: httpx.FormatTime(r.CreatedAt), UpdatedAt: httpx.FormatTime(r.UpdatedAt),
	}
}

func parseWindow(startsAt, endsAt *string) (*time.Time, *time.Time, error) {
	parse := func(s *string, field string) (*time.Time, error) {
		if s == nil || *s == "" {
			return nil, nil
		}
		t, err := time.Parse(time.RFC3339, *s)
		if err != nil {
			return nil, apperr.Validation(map[string]string{field: "Format tanggal tidak valid."})
		}
		return &t, nil
	}
	starts, err := parse(startsAt, "starts_at")
	if err != nil {
		return nil, nil, err
	}
	ends, err := parse(endsAt, "ends_at")
	if err != nil {
		return nil, nil, err
	}
	if starts != nil && ends != nil && !ends.After(*starts) {
		return nil, nil, apperr.Validation(map[string]string{"ends_at": "Waktu selesai harus setelah waktu mulai."})
	}
	return starts, ends, nil
}

func validateFAQTitle(typ string, title *string) error {
	if typ == TypeFAQ && (title == nil || *title == "") {
		return apperr.Validation(map[string]string{"title": "Wajib diisi untuk tipe faq."})
	}
	return nil
}

func mapWriteError(err error) error {
	if _, ok := database.CheckViolation(err); ok {
		return apperr.Validation(map[string]string{"ends_at": "Waktu selesai harus setelah waktu mulai, dan judul wajib diisi untuk FAQ."})
	}
	return fmt.Errorf("snippet: write: %w", err)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
