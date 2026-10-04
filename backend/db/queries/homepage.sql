-- name: ListActiveHomepageSections :many
SELECT id, type, label, position, is_active, config, page_key, updated_by, created_at, updated_at
FROM homepage_sections
WHERE page_key = $1 AND is_active
ORDER BY position;

-- name: ListHomepageSections :many
SELECT id, type, label, position, is_active, config, page_key, updated_by, created_at, updated_at
FROM homepage_sections
WHERE page_key = $1
ORDER BY position;

-- name: GetHomepageSection :one
SELECT * FROM homepage_sections WHERE id = $1;

-- name: CreateHomepageSection :one
INSERT INTO homepage_sections (type, label, position, is_active, config, page_key, updated_by)
VALUES (sqlc.arg(type), sqlc.arg(label), sqlc.arg(position), sqlc.arg(is_active), sqlc.arg(config),
        sqlc.arg(page_key), sqlc.narg(updated_by))
RETURNING *;

-- name: UpdateHomepageSection :one
UPDATE homepage_sections
SET label = sqlc.arg(label),
    is_active = sqlc.arg(is_active),
    config = sqlc.arg(config),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteHomepageSection :execrows
DELETE FROM homepage_sections WHERE id = $1;

-- UpdateHomepageSectionPosition: reorder uses a two-pass renumber in one tx
-- (negative positions first) so the (page_key, position) unique key never clashes.
-- name: UpdateHomepageSectionPosition :exec
UPDATE homepage_sections SET position = sqlc.arg(position) WHERE id = sqlc.arg(id);

-- name: MaxHomepagePosition :one
SELECT COALESCE(max(position), 0)::int AS max_position FROM homepage_sections WHERE page_key = $1;

-- name: ListHomepageSectionIDs :many
SELECT id FROM homepage_sections WHERE page_key = $1 ORDER BY position;
