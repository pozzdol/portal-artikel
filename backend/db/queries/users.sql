-- name: GetUserByEmail :one
SELECT id, email, phone, password_hash, display_name, slug, title, bio, avatar_media_id,
       can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at
FROM users
WHERE email = sqlc.arg(email)::citext;

-- name: GetUserByPhone :one
SELECT id, email, phone, password_hash, display_name, slug, title, bio, avatar_media_id,
       can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at
FROM users
WHERE phone = sqlc.arg(phone)::text;

-- name: GetUserBySlug :one
SELECT id, email, phone, display_name, slug, title, bio, avatar_media_id,
       can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at
FROM users
WHERE slug = $1;

-- name: GetUserByID :one
SELECT id, email, phone, display_name, slug, title, bio, avatar_media_id,
       can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at
FROM users
WHERE id = $1;

-- name: ListAuthors :many
SELECT id, display_name, slug, title, bio, avatar_media_id
FROM users
WHERE is_active
ORDER BY display_name, id;

-- name: CountUsers :one
SELECT count(*) FROM users;

-- name: ListUserPermissionCodes :many
SELECT DISTINCT p.code
FROM user_roles ur
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE ur.user_id = $1
ORDER BY p.code;

-- name: GetUserPasswordHash :one
SELECT password_hash FROM users WHERE id = $1;

-- name: GetUserAccess :one
SELECT is_active, can_login, must_change_password, perm_version FROM users WHERE id = $1;

-- name: ListUserRoles :many
SELECT r.id, r.code, r.name
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = $1
ORDER BY r.code;

-- name: ListUserRolesByUserIDs :many
SELECT ur.user_id, r.id, r.code, r.name
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = ANY(sqlc.arg(user_ids)::bigint[])
ORDER BY ur.user_id, r.code;

-- name: TouchLastLogin :exec
UPDATE users SET last_login_at = now() WHERE id = $1;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = sqlc.arg(display_name),
    title = sqlc.narg(title),
    bio = sqlc.narg(bio),
    avatar_media_id = sqlc.narg(avatar_media_id)
WHERE id = sqlc.arg(id)
RETURNING id, email, phone, display_name, slug, title, bio, avatar_media_id,
          can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = sqlc.arg(password_hash),
    must_change_password = sqlc.arg(must_change_password)
WHERE id = sqlc.arg(id);

-- name: ListUsers :many
SELECT u.id, u.email, u.phone, u.display_name, u.slug, u.title, u.bio, u.avatar_media_id,
       u.can_login, u.is_active, u.must_change_password, u.last_login_at, u.perm_version,
       u.created_at, u.updated_at
FROM users u
WHERE (sqlc.narg('q')::text IS NULL
       OR u.display_name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR u.email::text ILIKE '%' || sqlc.narg('q')::text || '%'
       OR u.phone ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('can_login')::boolean IS NULL OR u.can_login = sqlc.narg('can_login')::boolean)
  AND (sqlc.narg('is_active')::boolean IS NULL OR u.is_active = sqlc.narg('is_active')::boolean)
  AND (sqlc.narg('role_code')::text IS NULL OR EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.code = sqlc.narg('role_code')::text))
ORDER BY u.display_name, u.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountUsersFiltered :one
SELECT count(*)
FROM users u
WHERE (sqlc.narg('q')::text IS NULL
       OR u.display_name ILIKE '%' || sqlc.narg('q')::text || '%'
       OR u.email::text ILIKE '%' || sqlc.narg('q')::text || '%'
       OR u.phone ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('can_login')::boolean IS NULL OR u.can_login = sqlc.narg('can_login')::boolean)
  AND (sqlc.narg('is_active')::boolean IS NULL OR u.is_active = sqlc.narg('is_active')::boolean)
  AND (sqlc.narg('role_code')::text IS NULL OR EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.code = sqlc.narg('role_code')::text));

-- name: CreateUser :one
INSERT INTO users (email, phone, password_hash, display_name, slug, title, bio, avatar_media_id,
                   can_login, is_active, must_change_password)
VALUES (sqlc.narg(email)::citext, sqlc.narg(phone), sqlc.narg(password_hash), sqlc.arg(display_name), sqlc.arg(slug),
        sqlc.narg(title), sqlc.narg(bio), sqlc.narg(avatar_media_id), sqlc.arg(can_login), sqlc.arg(is_active),
        sqlc.arg(must_change_password))
RETURNING id, email, phone, display_name, slug, title, bio, avatar_media_id,
          can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at;

-- name: UpdateUserAdmin :one
UPDATE users
SET email = sqlc.narg(email)::citext,
    phone = sqlc.narg(phone),
    display_name = sqlc.arg(display_name),
    slug = sqlc.arg(slug),
    title = sqlc.narg(title),
    bio = sqlc.narg(bio),
    avatar_media_id = sqlc.narg(avatar_media_id),
    can_login = sqlc.arg(can_login),
    is_active = sqlc.arg(is_active)
WHERE id = sqlc.arg(id)
RETURNING id, email, phone, display_name, slug, title, bio, avatar_media_id,
          can_login, is_active, must_change_password, last_login_at, perm_version, created_at, updated_at;

-- name: ClearUserCredentials :exec
UPDATE users
SET email = NULL, phone = NULL, password_hash = NULL, can_login = false, must_change_password = false
WHERE id = $1;

-- name: SetUserActive :exec
UPDATE users SET is_active = sqlc.arg(is_active) WHERE id = sqlc.arg(id);

-- name: BumpUserPermVersion :one
UPDATE users SET perm_version = perm_version + 1 WHERE id = $1
RETURNING perm_version;

-- name: BumpPermVersionByRole :exec
UPDATE users SET perm_version = perm_version + 1
WHERE id IN (SELECT user_id FROM user_roles WHERE role_id = $1);

-- name: DeleteUserRoles :exec
DELETE FROM user_roles WHERE user_id = $1;

-- name: AddUserRoles :exec
INSERT INTO user_roles (user_id, role_id)
SELECT sqlc.arg(user_id)::bigint, unnest(sqlc.arg(role_ids)::bigint[])
ON CONFLICT DO NOTHING;

-- name: CountActiveSuperAdminsExcept :one
SELECT count(DISTINCT u.id)
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.code = 'super_admin'
  AND u.is_active AND u.can_login
  AND u.id <> sqlc.arg(exclude_user_id)::bigint;

-- name: ListUsersByIDs :many
SELECT id, display_name, slug, title, bio, avatar_media_id, is_active
FROM users
WHERE id = ANY(sqlc.arg(ids)::bigint[])
ORDER BY id;

-- ListAuthorsWithPublishedArticles: active users with >= 1 published article (sitemap).
-- name: ListAuthorsWithPublishedArticles :many
SELECT u.slug, u.display_name, max(a.published_at)::timestamptz AS last_published_at,
       max(a.updated_at)::timestamptz AS updated_at
FROM users u
JOIN articles a ON a.author_id = u.id
WHERE u.is_active
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
GROUP BY u.id
ORDER BY u.slug;
