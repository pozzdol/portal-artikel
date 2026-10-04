-- name: CreatePage :one
INSERT INTO pages (title, slug, content_json, content_html, status, seo_title, seo_description,
                   og_media_id, created_by, updated_by)
VALUES (sqlc.arg(title), sqlc.arg(slug), sqlc.arg(content_json), sqlc.arg(content_html), sqlc.arg(status),
        sqlc.narg(seo_title), sqlc.narg(seo_description), sqlc.narg(og_media_id),
        sqlc.narg(created_by), sqlc.narg(updated_by))
RETURNING *;

-- name: UpdatePage :one
UPDATE pages
SET title = sqlc.arg(title),
    slug = sqlc.arg(slug),
    content_json = sqlc.arg(content_json),
    content_html = sqlc.arg(content_html),
    status = sqlc.arg(status),
    seo_title = sqlc.narg(seo_title),
    seo_description = sqlc.narg(seo_description),
    og_media_id = sqlc.narg(og_media_id),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetPage :one
SELECT * FROM pages WHERE id = $1;

-- name: GetPageBySlug :one
SELECT * FROM pages WHERE slug = $1;

-- name: GetPublishedPageBySlug :one
SELECT * FROM pages WHERE slug = $1 AND status = 'published';

-- name: DeletePage :execrows
DELETE FROM pages WHERE id = $1;

-- name: PageSlugExists :one
SELECT EXISTS (
  SELECT 1 FROM pages WHERE slug = sqlc.arg(slug)::text AND id <> sqlc.arg(exclude_id)::bigint
) AS exists;

-- name: ListPages :many
SELECT * FROM pages ORDER BY title, id;

-- name: ListPublishedPages :many
SELECT slug, title, updated_at FROM pages
WHERE status = 'published'
ORDER BY title, id;
