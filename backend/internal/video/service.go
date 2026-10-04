package video

import (
	"context"
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

// Service implements video CRUD and public listing.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a video Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns the admin listing.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Item, int64, error) {
	q := dbgen.New(s.pool)
	params := dbgen.ListVideosAdminParams{
		Q: nullStr(f.Q), Status: nullStr(f.Status),
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	}
	rows, err := q.ListVideosAdmin(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("video: list: %w", err)
	}
	total, err := q.CountVideosAdmin(ctx, dbgen.CountVideosAdminParams{Q: params.Q, Status: params.Status})
	if err != nil {
		return nil, 0, fmt.Errorf("video: count: %w", err)
	}
	items := make([]Item, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(r)
	}
	return items, total, nil
}

// Get returns one video by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*Item, error) {
	row, err := dbgen.New(s.pool).GetVideo(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("video: get: %w", err)
	}
	item := itemFromRow(row)
	return &item, nil
}

// Create inserts a new video.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in Input) (*Item, error) {
	if err := validateYoutubeID(in.YoutubeID); err != nil {
		return nil, err
	}
	publishedAt, err := parseOptionalTime(in.PublishedAt, "published_at")
	if err != nil {
		return nil, err
	}
	status := in.Status
	if status == "" {
		status = content.StatusDraft
	}

	var out *Item
	var slug string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		var err error
		slug, err = uniqueSlug(ctx, q, in.Title, in.Slug, 0)
		if err != nil {
			return err
		}
		created, err := q.CreateVideo(ctx, dbgen.CreateVideoParams{
			Title: in.Title, Slug: slug, YoutubeID: in.YoutubeID, Description: in.Description,
			DurationSeconds: in.DurationSeconds, ViewCount: in.ViewCount, ThumbnailMediaID: in.ThumbnailMediaID,
			PublishedAt: publishedAt, IsFeatured: in.IsFeatured, Status: status,
			CreatedBy: meta.UserID, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityVideo,
			EntityID: &created.ID, Summary: "Video dibuat: " + created.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("video: audit: %w", err)
		}
		item := itemFromRow(created)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Video(slug), revalidate.TagVideos, revalidate.TagHomepage, revalidate.TagSitemap)
	return out, nil
}

// Update replaces a video.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in Input) (*Item, error) {
	if err := validateYoutubeID(in.YoutubeID); err != nil {
		return nil, err
	}
	publishedAt, err := parseOptionalTime(in.PublishedAt, "published_at")
	if err != nil {
		return nil, err
	}

	var out *Item
	var oldSlug, newSlug string
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetVideo(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("video: get for update: %w", err)
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
		updated, err := q.UpdateVideo(ctx, dbgen.UpdateVideoParams{
			ID: id, Title: in.Title, Slug: newSlug, YoutubeID: in.YoutubeID, Description: in.Description,
			DurationSeconds: in.DurationSeconds, ViewCount: in.ViewCount, ThumbnailMediaID: in.ThumbnailMediaID,
			PublishedAt: publishedAt, IsFeatured: in.IsFeatured, Status: status, UpdatedBy: meta.UserID,
		})
		if err != nil {
			return mapWriteError(err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityVideo,
			EntityID: &id, Summary: "Video diperbarui: " + updated.Title, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("video: audit: %w", err)
		}
		item := itemFromRow(updated)
		out = &item
		return nil
	})
	if err != nil {
		return nil, err
	}
	tags := []string{revalidate.Video(newSlug), revalidate.TagVideos, revalidate.TagHomepage, revalidate.TagSitemap}
	if oldSlug != newSlug {
		tags = append(tags, revalidate.Video(oldSlug))
	}
	s.reval.Enqueue(tags...)
	return out, nil
}

// Delete removes a video.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		existing, err := q.GetVideo(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("video: get for delete: %w", err)
		}
		slug = existing.Slug
		rows, err := q.DeleteVideo(ctx, id)
		if err != nil {
			return fmt.Errorf("video: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityVideo,
			EntityID: &id, Summary: "Video dihapus: " + existing.Title, IP: meta.IP,
		})
	})
	if err != nil {
		return err
	}
	s.reval.Enqueue(revalidate.Video(slug), revalidate.TagVideos, revalidate.TagHomepage, revalidate.TagSitemap)
	return nil
}

// ListPublic returns published videos.
func (s *Service) ListPublic(ctx context.Context, page httpx.Pagination) ([]content.VideoCard, int64, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListPublishedVideos(ctx, dbgen.ListPublishedVideosParams{
		ExcludeID: nil, Offset: int32(page.Offset), Limit: int32(page.PerPage),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("video: list public: %w", err)
	}
	total, err := q.CountPublishedVideos(ctx, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("video: count public: %w", err)
	}
	cards, err := content.NewHydrator(s.pool).VideoCards(ctx, rows)
	if err != nil {
		return nil, 0, fmt.Errorf("video: hydrate: %w", err)
	}
	return cards, total, nil
}

// GetPublic returns the public detail of a published video, plus up to 6
// other published videos.
func (s *Service) GetPublic(ctx context.Context, slug string) (*PublicDetail, error) {
	q := dbgen.New(s.pool)
	row, err := q.GetPublishedVideoBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("video: get public: %w", err)
	}
	hyd := content.NewHydrator(s.pool)
	card, err := singleVideoCard(ctx, hyd, row)
	if err != nil {
		return nil, err
	}
	otherRows, err := q.ListPublishedVideos(ctx, dbgen.ListPublishedVideosParams{
		ExcludeID: &row.ID, Offset: 0, Limit: 6,
	})
	if err != nil {
		return nil, fmt.Errorf("video: list others: %w", err)
	}
	others, err := hyd.VideoCards(ctx, otherRows)
	if err != nil {
		return nil, fmt.Errorf("video: hydrate others: %w", err)
	}
	return &PublicDetail{
		VideoCard: card, Description: row.Description,
		EmbedURL: richtext.YouTubeEmbedURL(row.YoutubeID), Others: others,
	}, nil
}

func singleVideoCard(ctx context.Context, hyd *content.Hydrator, row dbgen.Video) (content.VideoCard, error) {
	cards, err := hyd.VideoCards(ctx, []dbgen.Video{row})
	if err != nil {
		return content.VideoCard{}, fmt.Errorf("video: hydrate: %w", err)
	}
	return cards[0], nil
}

func itemFromRow(r dbgen.Video) Item {
	return Item{
		ID: r.ID, Title: r.Title, Slug: r.Slug, YoutubeID: r.YoutubeID, Description: r.Description,
		DurationSeconds: r.DurationSeconds, ViewCount: r.ViewCount, ThumbnailMediaID: r.ThumbnailMediaID,
		PublishedAt: httpx.FormatTime(r.PublishedAt), IsFeatured: r.IsFeatured, Status: r.Status,
		CreatedAt: httpx.FormatTime(r.CreatedAt), UpdatedAt: httpx.FormatTime(r.UpdatedAt),
	}
}

func validateYoutubeID(id string) error {
	if !isValidID(id) {
		return apperr.Validation(map[string]string{"youtube_id": "ID YouTube tidak valid."})
	}
	return nil
}

func parseOptionalTime(s *string, field string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil, apperr.Validation(map[string]string{field: "Format tanggal tidak valid."})
	}
	return &t, nil
}

// uniqueSlug derives a slug from title/want, appending a numeric suffix on
// conflict. excludeID = 0 on create.
func uniqueSlug(ctx context.Context, q *dbgen.Queries, title, want string, excludeID int64) (string, error) {
	if want != "" {
		if !slugutil.Valid(want) {
			return "", apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
		}
		exists, err := q.VideoSlugExists(ctx, dbgen.VideoSlugExistsParams{Slug: want, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("video: slug exists: %w", err)
		}
		if exists {
			return "", apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
		}
		return want, nil
	}
	base := slugutil.Make(title)
	if base == "" {
		base = "video"
	}
	slug := base
	for i := 2; ; i++ {
		exists, err := q.VideoSlugExists(ctx, dbgen.VideoSlugExistsParams{Slug: slug, ExcludeID: excludeID})
		if err != nil {
			return "", fmt.Errorf("video: slug exists: %w", err)
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

func mapWriteError(err error) error {
	if constraint, ok := database.UniqueViolation(err); ok && constraint == "videos_slug_key" {
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
	if constraint, ok := database.ForeignKeyViolation(err); ok && constraint == "videos_thumbnail_media_id_fkey" {
		return apperr.Validation(map[string]string{"thumbnail_media_id": "Media tidak ditemukan."})
	}
	if _, ok := database.CheckViolation(err); ok {
		return apperr.Validation(map[string]string{"youtube_id": "ID YouTube tidak valid."})
	}
	return fmt.Errorf("video: write: %w", err)
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
