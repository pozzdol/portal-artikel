// Client-side mirror of the backend upload rules (docs/05-api.md, Media):
// JPEG/PNG/GIF/WebP only, max 5 MB. The server stays authoritative
// (magic-byte sniff), this only saves a round trip for obvious mistakes.

import { isApiClientError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/forms/serverErrors';

export const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const ACCEPTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MSG_TOO_LARGE = 'Ukuran file melebihi batas 5 MB.';
export const MSG_BAD_TYPE =
  'Tipe file tidak didukung. Gunakan JPEG, PNG, GIF, atau WebP.';
export const MSG_EMPTY = 'File kosong.';

type FileLike = { name: string; type: string; size: number };

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

/**
 * MIME list for an `accept` filter (a MIME prefix like "image" or
 * "image/png"); unknown filters fall back to every accepted type.
 */
export function acceptedMimes(accept?: string): string[] {
  const all: string[] = [...ACCEPTED_MIME];
  if (!accept) return all;
  const prefix = accept.replace(/\/\*$/, '').toLowerCase();
  const hit = all.filter((m) => m === prefix || m.startsWith(`${prefix}/`));
  return hit.length > 0 ? hit : all;
}

/** Value for `<input type="file" accept>`. */
export function inputAccept(accept?: string): string {
  return acceptedMimes(accept).join(',');
}

/** Returns an Indonesian error message, or null when the file may be sent. */
export function precheckFile(file: FileLike, accept?: string): string | null {
  const allowed = acceptedMimes(accept);
  const type = file.type.toLowerCase();
  if (type) {
    if (!allowed.includes(type)) return MSG_BAD_TYPE;
  } else {
    // Some browsers/OSes send no MIME type; judge by extension.
    const ext = extensionOf(file.name);
    const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
    if (!extOk) return MSG_BAD_TYPE;
  }
  if (file.size <= 0) return MSG_EMPTY;
  if (file.size > MAX_UPLOAD_BYTES) return MSG_TOO_LARGE;
  return null;
}

/** Indonesian message for a failed upload (413/415 get fixed wording). */
export function uploadErrorMessage(err: unknown): string {
  if (isApiClientError(err)) {
    if (err.status === 413) return MSG_TOO_LARGE;
    if (err.status === 415) return MSG_BAD_TYPE;
    if (err.status === 0)
      return 'Koneksi gagal. Periksa jaringan lalu coba lagi.';
  }
  return apiErrorMessage(err);
}

/** "812 B", "48 KB", "1,2 MB" (Indonesian decimal comma). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  const n = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
  }).format(mb);
  return `${n} MB`;
}
