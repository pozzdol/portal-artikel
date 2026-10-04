// Package media implements upload, listing and metadata management for the
// media library backing article covers, event/alumni photos, video
// thumbnails and site settings images.
package media

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/media/storage"
)

// Service implements media upload and CRUD.
type Service struct {
	pool     *pgxpool.Pool
	storage  storage.Storage
	auditor  *audit.Logger
	maxBytes int64
}

// NewService returns a media Service. maxBytes bounds the raw upload size
// (before decoding); it is checked by DetectImage.
func NewService(pool *pgxpool.Pool, st storage.Storage, auditor *audit.Logger, maxBytes int64) *Service {
	return &Service{pool: pool, storage: st, auditor: auditor, maxBytes: maxBytes}
}

// MaxUploadBytes returns the configured upload size limit, for the handler
// to size its multipart body limit around.
func (s *Service) MaxUploadBytes() int64 { return s.maxBytes }

// Upload validates in.Reader as an image, stores it and inserts its row.
func (s *Service) Upload(ctx context.Context, meta audit.Meta, in UploadInput) (*Item, error) {
	info, data, err := DetectImage(in.Reader, s.maxBytes)
	if err != nil {
		return nil, err
	}
	key := storage.NewKey(time.Now(), info.Ext)
	if err := s.storage.Put(ctx, key, bytes.NewReader(data), info.Mime); err != nil {
		return nil, fmt.Errorf("media: store upload: %w", err)
	}

	var out *Item
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		width, height := info.Width, info.Height
		created, err := q.CreateMedia(ctx, dbgen.CreateMediaParams{
			StorageKey:   key,
			Url:          s.storage.URL(key),
			OriginalName: in.Filename,
			MimeType:     info.Mime,
			SizeBytes:    info.Size,
			Width:        &width,
			Height:       &height,
			AltText:      in.AltText,
			Caption:      in.Caption,
			UploadedBy:   meta.UserID,
		})
		if err != nil {
			return fmt.Errorf("media: create: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpload, EntityType: audit.EntityMedia,
			EntityID: &created.ID, Summary: "Media diunggah: " + created.OriginalName,
			Changes: map[string]any{"mime_type": created.MimeType, "size_bytes": created.SizeBytes},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("media: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		// Best-effort cleanup: the row never committed, so the stored file
		// would otherwise be orphaned.
		if delErr := s.storage.Delete(context.WithoutCancel(ctx), key); delErr != nil {
			slog.WarnContext(ctx, "media: cleanup stored file after failed upload", "key", key, "error", delErr)
		}
		return nil, err
	}
	return out, nil
}

// List returns a page of media rows, most recent first.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Item, int64, error) {
	q := dbgen.New(s.pool)
	var qp, mimePrefix *string
	if f.Q != "" {
		qp = &f.Q
	}
	if f.MimePrefix != "" {
		mimePrefix = &f.MimePrefix
	}
	rows, err := q.ListMedia(ctx, dbgen.ListMediaParams{
		Q: qp, MimePrefix: mimePrefix,
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("media: list: %w", err)
	}
	total, err := q.CountMedia(ctx, dbgen.CountMediaParams{Q: qp, MimePrefix: mimePrefix})
	if err != nil {
		return nil, 0, fmt.Errorf("media: count: %w", err)
	}
	items := make([]Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, itemFromRow(r))
	}
	return items, total, nil
}

// ListByIDs resolves a set of media ids (for the admin media picker),
// returning items in the same order as ids and silently skipping any id that
// does not exist.
func (s *Service) ListByIDs(ctx context.Context, ids []int64) ([]Item, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListMediaByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("media: list by ids: %w", err)
	}
	byID := make(map[int64]dbgen.Medium, len(rows))
	for _, row := range rows {
		byID[row.ID] = row
	}
	items := make([]Item, 0, len(ids))
	for _, id := range ids {
		if row, ok := byID[id]; ok {
			items = append(items, itemFromRow(row))
		}
	}
	return items, nil
}

// Get returns one media row by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	q := dbgen.New(s.pool)
	m, err := q.GetMedia(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("media: get: %w", err)
	}
	item := itemFromRow(m)
	return &item, nil
}

// UpdateMeta changes alt text and/or caption.
func (s *Service) UpdateMeta(ctx context.Context, meta audit.Meta, id int64, in UpdateMetaInput) (*Item, error) {
	var out *Item
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if _, err := q.GetMedia(ctx, id); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("media: get for update: %w", err)
		}
		updated, err := q.UpdateMediaMeta(ctx, dbgen.UpdateMediaMetaParams{
			AltText: in.AltText, Caption: in.Caption, ID: id,
		})
		if err != nil {
			return fmt.Errorf("media: update meta: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityMedia,
			EntityID: &id, Summary: "Metadata media diperbarui: " + updated.OriginalName, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("media: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Delete removes a media row and its stored file. It refuses (409) when the
// media is still referenced by any content or setting.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var storageKey, originalName string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		m, err := q.GetMedia(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("media: get for delete: %w", err)
		}
		refs, err := q.CountMediaReferences(ctx, id)
		if err != nil {
			return fmt.Errorf("media: count references: %w", err)
		}
		if refs > 0 {
			return apperr.Conflict(fmt.Sprintf("Media masih dipakai oleh %d konten.", refs))
		}
		rows, err := q.DeleteMedia(ctx, id)
		if err != nil {
			return fmt.Errorf("media: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		storageKey, originalName = m.StorageKey, m.OriginalName
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityMedia,
			EntityID: &id, Summary: "Media dihapus: " + originalName, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	if err := s.storage.Delete(context.WithoutCancel(ctx), storageKey); err != nil {
		slog.WarnContext(ctx, "media: delete stored file", "key", storageKey, "error", err)
	}
	return nil
}
