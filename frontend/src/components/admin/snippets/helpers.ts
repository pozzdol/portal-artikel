import type {
  AdminSnippet,
  SnippetInput,
  SnippetType,
} from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';

export const SNIPPET_TABS: readonly { value: SnippetType; label: string }[] = [
  { value: 'announcement', label: 'Pengumuman' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'quote', label: 'Kutipan' },
  { value: 'faq', label: 'FAQ' },
];

export const SNIPPET_TYPE_LABEL: Record<SnippetType, string> = {
  announcement: 'pengumuman',
  breaking: 'breaking news',
  quote: 'kutipan',
  faq: 'pertanyaan',
};

export const SNIPPET_TYPE_HINT: Record<SnippetType, string> = {
  announcement:
    'Tampil di bar atas beranda; lebih dari satu dipisah tanda titik emas.',
  breaking: 'Berputar di ticker breaking news.',
  quote: 'Berputar di section kutipan beranda.',
  faq: 'Tampil pada section Pertanyaan Umum di beranda.',
};

/** Strips the sanitizer's allowed inline tags for a plain-text preview. */
export function stripInlineHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One-line label for a snippet row (question for FAQ, else the body). */
export function snippetPreviewTitle(s: AdminSnippet): string | null {
  if (s.type === 'faq') return s.title;
  return null;
}

export function snippetPreviewBody(s: AdminSnippet): string {
  return stripInlineHtml(s.body) || '(kosong)';
}

/** "27 Sep 2026, 20:00 – 30 Sep 2026" style period label, WIB. */
export function snippetPeriodLabel(s: AdminSnippet): string | null {
  if (!s.starts_at && !s.ends_at) return null;
  const fmt = (v: string) => formatWib(v, 'd MMM yyyy, HH:mm');
  if (s.starts_at && s.ends_at)
    return `${fmt(s.starts_at)} – ${fmt(s.ends_at)}`;
  if (s.starts_at) return `Mulai ${fmt(s.starts_at)}`;
  return `Sampai ${fmt(s.ends_at as string)}`;
}

/** Full Input matching an existing row (used to flip is_active in place). */
export function snippetToInput(s: AdminSnippet): SnippetInput {
  return {
    type: s.type,
    title: s.title,
    body: s.body,
    source: s.source,
    link_url: s.link_url,
    sort_order: s.sort_order,
    is_active: s.is_active,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
  };
}

/** Sort_order for a new row so it lands at the end of its type's list. */
export function nextSortOrder(items: AdminSnippet[]): number {
  return items.reduce((max, s) => Math.max(max, s.sort_order), 0) + 10;
}
