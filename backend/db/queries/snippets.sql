-- Active window predicate (ListActive*):
--   is_active AND (starts_at IS NULL OR starts_at <= now) AND (ends_at IS NULL OR ends_at > now)

-- name: CreateSnippet :one
INSERT INTO snippets (type, title, body, source, link_url, sort_order, is_active, starts_at, ends_at)
VALUES (sqlc.arg(type), sqlc.narg(title), sqlc.arg(body), sqlc.narg(source), sqlc.narg(link_url),
        sqlc.arg(sort_order), sqlc.arg(is_active), sqlc.narg(starts_at), sqlc.narg(ends_at))
RETURNING *;

-- name: UpdateSnippet :one
UPDATE snippets
SET type = sqlc.arg(type),
    title = sqlc.narg(title),
    body = sqlc.arg(body),
    source = sqlc.narg(source),
    link_url = sqlc.narg(link_url),
    sort_order = sqlc.arg(sort_order),
    is_active = sqlc.arg(is_active),
    starts_at = sqlc.narg(starts_at),
    ends_at = sqlc.narg(ends_at)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetSnippet :one
SELECT * FROM snippets WHERE id = $1;

-- name: DeleteSnippet :execrows
DELETE FROM snippets WHERE id = $1;

-- name: ListSnippetsAdmin :many
SELECT * FROM snippets
WHERE sqlc.narg('type')::text IS NULL OR type = sqlc.narg('type')::text
ORDER BY type, sort_order, id;

-- name: ListActiveSnippets :many
SELECT * FROM snippets
WHERE (sqlc.narg('type')::text IS NULL OR type = sqlc.narg('type')::text)
  AND is_active
  AND (starts_at IS NULL OR starts_at <= sqlc.arg('now')::timestamptz)
  AND (ends_at IS NULL OR ends_at > sqlc.arg('now')::timestamptz)
ORDER BY sort_order, id;

-- name: UpdateSnippetOrder :exec
UPDATE snippets SET sort_order = sqlc.arg(sort_order) WHERE id = sqlc.arg(id);

-- CountSnippetTransitions: active snippets whose window opened or closed in (since, now].
-- name: CountSnippetTransitions :one
SELECT count(*) FROM snippets
WHERE is_active
  AND ((starts_at > sqlc.arg('since')::timestamptz AND starts_at <= sqlc.arg('now')::timestamptz)
       OR (ends_at > sqlc.arg('since')::timestamptz AND ends_at <= sqlc.arg('now')::timestamptz));
