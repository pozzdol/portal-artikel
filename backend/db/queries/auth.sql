-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent, ip)
VALUES (sqlc.arg(user_id), COALESCE(sqlc.narg(family_id)::uuid, gen_random_uuid()),
        sqlc.arg(token_hash), sqlc.arg(expires_at), sqlc.narg(user_agent), sqlc.narg(ip))
RETURNING id, family_id, expires_at;

-- name: GetRefreshTokenByHashForUpdate :one
SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, rt.rotated_at, rt.revoked_at,
       u.is_active, u.can_login, u.perm_version
FROM refresh_tokens rt
JOIN users u ON u.id = rt.user_id
WHERE rt.token_hash = $1
FOR UPDATE OF rt;

-- name: MarkRefreshTokenRotated :exec
UPDATE refresh_tokens SET rotated_at = now() WHERE id = $1;

-- name: RevokeRefreshTokenFamily :execrows
UPDATE refresh_tokens SET revoked_at = now()
WHERE family_id = $1 AND revoked_at IS NULL;

-- name: RevokeUserRefreshTokenFamily :execrows
UPDATE refresh_tokens SET revoked_at = now()
WHERE family_id = sqlc.arg(family_id) AND user_id = sqlc.arg(user_id) AND revoked_at IS NULL;

-- name: RevokeAllUserRefreshTokens :execrows
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = $1 AND revoked_at IS NULL;

-- name: RevokeOtherUserRefreshTokens :execrows
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = sqlc.arg(user_id) AND family_id <> sqlc.arg(keep_family_id) AND revoked_at IS NULL;

-- name: ListActiveSessions :many
SELECT rt.family_id, rt.user_agent, rt.ip,
       (SELECT min(f.created_at) FROM refresh_tokens f WHERE f.family_id = rt.family_id)::timestamptz AS started_at,
       rt.created_at AS last_used_at,
       rt.expires_at
FROM refresh_tokens rt
WHERE rt.user_id = $1
  AND rt.revoked_at IS NULL
  AND rt.rotated_at IS NULL
  AND rt.expires_at > now()
ORDER BY rt.created_at DESC;

-- name: DeleteExpiredRefreshTokens :execrows
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days';
