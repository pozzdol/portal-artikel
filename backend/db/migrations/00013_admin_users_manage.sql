-- +goose Up
-- Admins may manage login accounts too. Super admin accounts and the
-- super_admin role stay off-limits to them (enforced in internal/user).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'admin' AND p.code = 'users.manage'
ON CONFLICT DO NOTHING;

-- Bump perm_version so signed-in admins pick up the new permission.
UPDATE users SET perm_version = perm_version + 1
WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'admin');

-- +goose Down
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'admin')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'users.manage');

UPDATE users SET perm_version = perm_version + 1
WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code = 'admin');
