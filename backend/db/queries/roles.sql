-- name: ListRoles :many
SELECT r.id, r.code, r.name, r.description, r.is_system, r.created_at,
       (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
FROM roles r
ORDER BY r.is_system DESC, r.code;

-- name: GetRole :one
SELECT id, code, name, description, is_system, created_at
FROM roles
WHERE id = $1;

-- name: ListRolesByIDs :many
SELECT id, code, name, description, is_system, created_at
FROM roles
WHERE id = ANY(sqlc.arg(ids)::bigint[])
ORDER BY code;

-- name: ListAllRolePermissions :many
SELECT rp.role_id, p.code
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
ORDER BY rp.role_id, p.code;

-- name: ListRolePermissionCodes :many
SELECT p.code
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role_id = $1
ORDER BY p.code;

-- name: CreateRole :one
INSERT INTO roles (code, name, description)
VALUES (sqlc.arg(code), sqlc.arg(name), sqlc.narg(description))
RETURNING id, code, name, description, is_system, created_at;

-- name: UpdateRole :one
UPDATE roles SET name = sqlc.arg(name), description = sqlc.narg(description)
WHERE id = sqlc.arg(id)
RETURNING id, code, name, description, is_system, created_at;

-- name: DeleteRole :execrows
DELETE FROM roles WHERE id = $1 AND NOT is_system;

-- name: CountRoleUsers :one
SELECT count(*) FROM user_roles WHERE role_id = $1;

-- name: DeleteRolePermissions :exec
DELETE FROM role_permissions WHERE role_id = $1;

-- name: AddRolePermissions :exec
INSERT INTO role_permissions (role_id, permission_id)
SELECT sqlc.arg(role_id)::bigint, unnest(sqlc.arg(permission_ids)::bigint[])
ON CONFLICT DO NOTHING;

-- name: ListPermissions :many
SELECT id, code, description FROM permissions ORDER BY code;

-- name: ListPermissionsByCodes :many
SELECT id, code, description FROM permissions
WHERE code = ANY(sqlc.arg(codes)::text[])
ORDER BY code;
