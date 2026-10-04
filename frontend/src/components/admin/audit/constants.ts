// Mirrors the Go audit action/entity_type string constants
// (backend/internal/audit/audit.go) with Indonesian labels for the UI.

export const ACTION_LABEL: Record<string, string> = {
  login: 'Masuk',
  login_failed: 'Gagal masuk',
  logout: 'Keluar',
  refresh_reuse: 'Reuse token',
  password_change: 'Ubah kata sandi',
  reset_password: 'Reset kata sandi',
  session_revoke: 'Keluarkan sesi',
  create: 'Buat',
  update: 'Perbarui',
  delete: 'Hapus',
  activate: 'Aktifkan',
  deactivate: 'Nonaktifkan',
  publish: 'Terbitkan',
  unpublish: 'Batalkan terbit',
  schedule: 'Jadwalkan',
  restore: 'Pulihkan',
  reorder: 'Urutkan ulang',
  merge: 'Gabung',
  upload: 'Unggah',
};

export const ENTITY_LABEL: Record<string, string> = {
  user: 'Pengguna',
  role: 'Role',
  article: 'Artikel',
  category: 'Kategori',
  tag: 'Tag',
  media: 'Media',
  event: 'Agenda',
  alumni: 'Alumni',
  video: 'Video',
  page: 'Halaman',
  snippet: 'Snippet',
  homepage_section: 'Section beranda',
  menu: 'Menu',
  setting: 'Pengaturan',
};

export const ACTIONS = Object.keys(ACTION_LABEL);
export const ENTITY_TYPES = Object.keys(ENTITY_LABEL);

/** Admin routes that carry a per-id edit page; other entity types render as plain text. */
const ENTITY_ROUTE: Partial<Record<string, string>> = {
  article: 'articles',
  event: 'events',
  alumni: 'alumni',
  video: 'videos',
  page: 'pages',
};

export function entityHref(
  entityType: string,
  entityId: number | null,
): string | null {
  const segment = ENTITY_ROUTE[entityType];
  if (!segment || entityId == null) return null;
  return `/admin/${segment}/${entityId}`;
}

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABEL[entityType] ?? entityType;
}
