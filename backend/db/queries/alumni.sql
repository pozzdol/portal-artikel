-- name: CreateAlumni :one
INSERT INTO alumni_profiles (
  name, slug, role_title, class_year, short_bio, story_json, story_html, photo_media_id,
  is_featured, sort_order, status, seo_title, seo_description, created_by, updated_by)
VALUES (
  sqlc.arg(name), sqlc.arg(slug), sqlc.arg(role_title), sqlc.narg(class_year), sqlc.arg(short_bio),
  sqlc.narg(story_json), sqlc.narg(story_html), sqlc.narg(photo_media_id),
  sqlc.arg(is_featured), sqlc.arg(sort_order), sqlc.arg(status),
  sqlc.narg(seo_title), sqlc.narg(seo_description), sqlc.narg(created_by), sqlc.narg(updated_by))
RETURNING *;

-- name: UpdateAlumni :one
UPDATE alumni_profiles
SET name = sqlc.arg(name),
    slug = sqlc.arg(slug),
    role_title = sqlc.arg(role_title),
    class_year = sqlc.narg(class_year),
    short_bio = sqlc.arg(short_bio),
    story_json = sqlc.narg(story_json),
    story_html = sqlc.narg(story_html),
    photo_media_id = sqlc.narg(photo_media_id),
    is_featured = sqlc.arg(is_featured),
    sort_order = sqlc.arg(sort_order),
    status = sqlc.arg(status),
    seo_title = sqlc.narg(seo_title),
    seo_description = sqlc.narg(seo_description),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetAlumni :one
SELECT * FROM alumni_profiles WHERE id = $1;

-- name: GetAlumniBySlug :one
SELECT * FROM alumni_profiles WHERE slug = $1;

-- name: GetPublishedAlumniBySlug :one
SELECT * FROM alumni_profiles WHERE slug = $1 AND status = 'published';

-- name: DeleteAlumni :execrows
DELETE FROM alumni_profiles WHERE id = $1;

-- name: AlumniSlugExists :one
SELECT EXISTS (
  SELECT 1 FROM alumni_profiles WHERE slug = sqlc.arg(slug)::text AND id <> sqlc.arg(exclude_id)::bigint
) AS exists;

-- name: ListAlumniAdmin :many
SELECT * FROM alumni_profiles
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY sort_order, id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAlumniAdmin :one
SELECT count(*) FROM alumni_profiles
WHERE (sqlc.narg('q')::text IS NULL OR name ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text);

-- name: ListPublishedAlumni :many
SELECT * FROM alumni_profiles
WHERE status = 'published'
  AND (sqlc.narg('featured')::bool IS NULL OR is_featured = sqlc.narg('featured')::bool)
ORDER BY sort_order, id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPublishedAlumni :one
SELECT count(*) FROM alumni_profiles
WHERE status = 'published'
  AND (sqlc.narg('featured')::bool IS NULL OR is_featured = sqlc.narg('featured')::bool);

-- name: UpdateAlumniOrder :exec
UPDATE alumni_profiles SET sort_order = sqlc.arg(sort_order) WHERE id = sqlc.arg(id);

-- name: ListPublishedAlumniForSitemap :many
SELECT slug, updated_at FROM alumni_profiles
WHERE status = 'published'
ORDER BY sort_order, id;
