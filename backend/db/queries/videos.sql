-- Public video queries: status = 'published' AND published_at <= now().

-- name: CreateVideo :one
INSERT INTO videos (
  title, slug, youtube_id, description, duration_seconds, view_count, thumbnail_media_id,
  published_at, is_featured, status, created_by, updated_by)
VALUES (
  sqlc.arg(title), sqlc.arg(slug), sqlc.arg(youtube_id), sqlc.narg(description),
  sqlc.narg(duration_seconds), sqlc.narg(view_count), sqlc.narg(thumbnail_media_id),
  COALESCE(sqlc.narg(published_at)::timestamptz, now()), sqlc.arg(is_featured), sqlc.arg(status),
  sqlc.narg(created_by), sqlc.narg(updated_by))
RETURNING *;

-- UpdateVideo: published_at NULL keeps the stored value.
-- name: UpdateVideo :one
UPDATE videos
SET title = sqlc.arg(title),
    slug = sqlc.arg(slug),
    youtube_id = sqlc.arg(youtube_id),
    description = sqlc.narg(description),
    duration_seconds = sqlc.narg(duration_seconds),
    view_count = sqlc.narg(view_count),
    thumbnail_media_id = sqlc.narg(thumbnail_media_id),
    published_at = COALESCE(sqlc.narg(published_at)::timestamptz, published_at),
    is_featured = sqlc.arg(is_featured),
    status = sqlc.arg(status),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetVideo :one
SELECT * FROM videos WHERE id = $1;

-- name: GetVideoBySlug :one
SELECT * FROM videos WHERE slug = $1;

-- name: GetPublishedVideoBySlug :one
SELECT * FROM videos WHERE slug = $1 AND status = 'published' AND published_at <= now();

-- name: DeleteVideo :execrows
DELETE FROM videos WHERE id = $1;

-- name: VideoSlugExists :one
SELECT EXISTS (
  SELECT 1 FROM videos WHERE slug = sqlc.arg(slug)::text AND id <> sqlc.arg(exclude_id)::bigint
) AS exists;

-- name: ListVideosAdmin :many
SELECT * FROM videos
WHERE (sqlc.narg('q')::text IS NULL OR title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY published_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountVideosAdmin :one
SELECT count(*) FROM videos
WHERE (sqlc.narg('q')::text IS NULL OR title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text);

-- ListPublishedVideos: exclude_id NULL = none (detail "other videos").
-- name: ListPublishedVideos :many
SELECT * FROM videos
WHERE status = 'published' AND published_at <= now()
  AND (sqlc.narg('exclude_id')::bigint IS NULL OR id <> sqlc.narg('exclude_id')::bigint)
ORDER BY is_featured DESC, published_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPublishedVideos :one
SELECT count(*) FROM videos
WHERE status = 'published' AND published_at <= now()
  AND (sqlc.narg('exclude_id')::bigint IS NULL OR id <> sqlc.narg('exclude_id')::bigint);

-- name: ListPublishedVideosForSitemap :many
SELECT slug, updated_at FROM videos
WHERE status = 'published' AND published_at <= now()
ORDER BY published_at DESC, id DESC;
