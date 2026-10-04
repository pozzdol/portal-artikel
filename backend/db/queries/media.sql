-- name: CreateMedia :one
INSERT INTO media (storage_key, url, original_name, mime_type, size_bytes,
                   width, height, alt_text, caption, uploaded_by)
VALUES (sqlc.arg(storage_key), sqlc.arg(url), sqlc.arg(original_name), sqlc.arg(mime_type),
        sqlc.arg(size_bytes), sqlc.narg(width), sqlc.narg(height), sqlc.narg(alt_text),
        sqlc.narg(caption), sqlc.narg(uploaded_by))
RETURNING *;

-- name: GetMedia :one
SELECT * FROM media WHERE id = $1;

-- name: ListMediaByIDs :many
SELECT * FROM media WHERE id = ANY(sqlc.arg(ids)::bigint[]) ORDER BY id;

-- name: ListMedia :many
SELECT * FROM media
WHERE (sqlc.narg('q')::text IS NULL
       OR original_name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR alt_text ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('mime_prefix')::text IS NULL OR mime_type LIKE sqlc.narg('mime_prefix')::text || '%')
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountMedia :one
SELECT count(*) FROM media
WHERE (sqlc.narg('q')::text IS NULL
       OR original_name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR alt_text ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('mime_prefix')::text IS NULL OR mime_type LIKE sqlc.narg('mime_prefix')::text || '%');

-- name: UpdateMediaMeta :one
UPDATE media SET alt_text = sqlc.narg(alt_text), caption = sqlc.narg(caption)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteMedia :execrows
DELETE FROM media WHERE id = $1;

-- CountMediaReferences counts every row that points at a media id, including
-- soft-deleted articles and media ids stored inside site_settings JSON.
-- name: CountMediaReferences :one
SELECT (
    (SELECT count(*) FROM articles WHERE cover_media_id = sqlc.arg(id)::bigint OR og_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM events WHERE cover_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM alumni_profiles WHERE photo_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM videos WHERE thumbnail_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM pages WHERE og_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM users WHERE avatar_media_id = sqlc.arg(id)::bigint)
  + (SELECT count(*) FROM site_settings s
     WHERE jsonb_typeof(s.value) = 'object'
       AND (s.value -> 'logo_media_id' = to_jsonb(sqlc.arg(id)::bigint)
            OR s.value -> 'favicon_media_id' = to_jsonb(sqlc.arg(id)::bigint)
            OR s.value -> 'default_og_media_id' = to_jsonb(sqlc.arg(id)::bigint)))
)::bigint AS refs;
