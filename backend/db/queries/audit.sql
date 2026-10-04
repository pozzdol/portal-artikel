-- name: InsertAuditLog :exec
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, summary, changes, ip)
VALUES (sqlc.narg(user_id), sqlc.arg(action), sqlc.arg(entity_type), sqlc.narg(entity_id),
        sqlc.arg(summary), sqlc.narg(changes), sqlc.narg(ip));

-- name: ListAuditLogs :many
SELECT a.id, a.user_id, u.display_name AS user_display_name, a.action, a.entity_type,
       a.entity_id, a.summary, a.changes, a.ip, a.created_at
FROM audit_logs a
LEFT JOIN users u ON u.id = a.user_id
WHERE (sqlc.narg('entity_type')::text IS NULL OR a.entity_type = sqlc.narg('entity_type')::text)
  AND (sqlc.narg('user_id')::bigint IS NULL OR a.user_id = sqlc.narg('user_id')::bigint)
  AND (sqlc.narg('action')::text IS NULL OR a.action = sqlc.narg('action')::text)
  AND (sqlc.narg('from')::timestamptz IS NULL OR a.created_at >= sqlc.narg('from')::timestamptz)
  AND (sqlc.narg('to')::timestamptz IS NULL OR a.created_at < sqlc.narg('to')::timestamptz)
ORDER BY a.created_at DESC, a.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAuditLogs :one
SELECT count(*)
FROM audit_logs a
WHERE (sqlc.narg('entity_type')::text IS NULL OR a.entity_type = sqlc.narg('entity_type')::text)
  AND (sqlc.narg('user_id')::bigint IS NULL OR a.user_id = sqlc.narg('user_id')::bigint)
  AND (sqlc.narg('action')::text IS NULL OR a.action = sqlc.narg('action')::text)
  AND (sqlc.narg('from')::timestamptz IS NULL OR a.created_at >= sqlc.narg('from')::timestamptz)
  AND (sqlc.narg('to')::timestamptz IS NULL OR a.created_at < sqlc.narg('to')::timestamptz);
