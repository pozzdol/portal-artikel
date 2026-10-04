-- name: GetSetting :one
SELECT key, value, updated_by, updated_at
FROM site_settings
WHERE key = $1;

-- name: ListSettings :many
SELECT key, value, updated_by, updated_at
FROM site_settings
ORDER BY key;

-- name: UpsertSetting :exec
INSERT INTO site_settings (key, value, updated_by)
VALUES ($1, $2, $3)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by;
