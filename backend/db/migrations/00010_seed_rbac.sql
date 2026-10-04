-- +goose Up
INSERT INTO roles (code, name, description, is_system) VALUES
  ('super_admin', 'Super Administrator', 'Akses penuh ke seluruh sistem', true),
  ('admin', 'Administrator', 'Mengelola konten dan tampilan situs', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('dashboard.view',      'Melihat dasbor admin'),
  ('articles.read',       'Melihat daftar dan detail artikel di admin'),
  ('articles.create',     'Membuat artikel baru'),
  ('articles.update',     'Mengubah artikel'),
  ('articles.delete',     'Menghapus artikel'),
  ('articles.publish',    'Menerbitkan, membatalkan terbit, dan menjadwalkan artikel'),
  ('articles.update_any', 'Mengubah artikel milik penulis lain'),
  ('categories.manage',   'Mengelola kategori'),
  ('tags.manage',         'Mengelola tag'),
  ('media.manage',        'Mengelola pustaka media'),
  ('events.manage',       'Mengelola agenda'),
  ('alumni.manage',       'Mengelola profil tokoh alumni'),
  ('videos.manage',       'Mengelola video'),
  ('pages.manage',        'Mengelola halaman statis'),
  ('snippets.manage',     'Mengelola pengumuman, breaking news, kutipan, dan FAQ'),
  ('homepage.manage',     'Mengatur susunan section homepage'),
  ('menus.manage',        'Mengelola menu navigasi'),
  ('authors.manage',      'Mengelola profil penulis tanpa akses login'),
  ('settings.manage',     'Mengelola identitas situs, kontak, media sosial, dan SEO default'),
  ('users.manage',        'Mengelola akun login, reset kata sandi, dan penetapan role'),
  ('roles.manage',        'Mengelola role dan hak akses'),
  ('audit.view',          'Melihat log audit')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'admin'
  AND p.code NOT IN ('settings.manage', 'users.manage', 'roles.manage', 'audit.view')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE code IN ('super_admin', 'admin'));

DELETE FROM permissions WHERE code IN (
  'dashboard.view', 'articles.read', 'articles.create', 'articles.update', 'articles.delete',
  'articles.publish', 'articles.update_any', 'categories.manage', 'tags.manage', 'media.manage',
  'events.manage', 'alumni.manage', 'videos.manage', 'pages.manage', 'snippets.manage',
  'homepage.manage', 'menus.manage', 'authors.manage', 'settings.manage', 'users.manage',
  'roles.manage', 'audit.view');

DELETE FROM roles WHERE code IN ('super_admin', 'admin');
