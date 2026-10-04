// Pure helpers for the article editor: zod schema, API ⇄ form mapping,
// dirty snapshots and category lookups. No React here (unit-tested).

import { z } from 'zod';

import {
  MSG,
  SLUG_RE,
  mediaId,
  optionalDate,
  optionalText,
  optionalUrl,
  requiredId,
  requiredText,
} from '@/lib/forms/schemas';
import type {
  AdminArticleDetail,
  ArticleInput,
  ArticleSort,
  ArticleStatus,
  CategoryTreeNode,
  RichTextJSON,
} from '@/lib/api/admin/types';

export const TITLE_MAX = 200;
export const EXCERPT_MAX = 300;
export const CAPTION_MAX = 300;
export const LOCATION_MAX = 200;
export const MAX_TAGS = 20;
export const MAX_NEW_TAGS = 10;

/** Category slug whose articles (and its children's) carry activity fields. */
export const EVENT_CATEGORY_SLUG = 'yayasan';

export const EMPTY_DOC: RichTextJSON = { type: 'doc', content: [] };

export const articleSchema = z.object({
  title: requiredText(TITLE_MAX),
  slug: z
    .string()
    .trim()
    .max(160, MSG.maxChars(160))
    .refine((v) => v === '' || SLUG_RE.test(v), MSG.slug),
  excerpt: optionalText(EXCERPT_MAX),
  content: z.object({
    json: z.unknown().nullable(),
    html: z.string(),
  }),
  category_id: requiredId,
  author_id: z.number().int().positive().nullable(),
  tags: z
    .object({
      ids: z.array(z.number().int().positive()),
      newTags: z.array(z.string().trim().min(1).max(60, MSG.maxChars(60))),
    })
    .refine((t) => t.ids.length + t.newTags.length <= MAX_TAGS, {
      message: `Maksimal ${MAX_TAGS} tag.`,
    })
    .refine((t) => t.newTags.length <= MAX_NEW_TAGS, {
      message: `Maksimal ${MAX_NEW_TAGS} tag baru sekaligus.`,
    }),
  cover_media_id: mediaId,
  cover_caption: optionalText(CAPTION_MAX),
  is_featured: z.boolean(),
  is_breaking: z.boolean(),
  event_date: optionalDate,
  event_location: optionalText(LOCATION_MAX),
  seo_title: optionalText(200),
  seo_description: optionalText(300),
  og_media_id: mediaId,
  canonical_url: optionalUrl(500),
});

export type ArticleFormValues = z.input<typeof articleSchema>;
export type ArticleFormOutput = z.output<typeof articleSchema>;

/** Server 422 keys → form paths (the rest match by name). */
export const SERVER_FIELD_MAP = {
  content_json: 'content',
  content_html: 'content',
  tag_ids: 'tags',
  new_tags: 'tags',
} as const;

export const KNOWN_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'content',
  'category_id',
  'author_id',
  'tags',
  'cover_media_id',
  'cover_caption',
  'is_featured',
  'is_breaking',
  'event_date',
  'event_location',
  'seo_title',
  'seo_description',
  'og_media_id',
  'canonical_url',
] as const;

export function emptyArticleValues(
  authorId: number | null = null,
): ArticleFormValues {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: { json: EMPTY_DOC, html: '' },
    category_id: null,
    author_id: authorId,
    tags: { ids: [], newTags: [] },
    cover_media_id: null,
    cover_caption: '',
    is_featured: false,
    is_breaking: false,
    event_date: null,
    event_location: '',
    seo_title: '',
    seo_description: '',
    og_media_id: null,
    canonical_url: '',
  };
}

export function articleToValues(a: AdminArticleDetail): ArticleFormValues {
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt ?? '',
    content: { json: a.content_json ?? EMPTY_DOC, html: a.content_html ?? '' },
    category_id: a.category_id,
    author_id: a.author_id,
    tags: { ids: a.tags.map((t) => t.id), newTags: [] },
    cover_media_id: a.cover_media_id,
    cover_caption: a.cover_caption ?? '',
    is_featured: a.is_featured,
    is_breaking: a.is_breaking,
    event_date: a.event_date,
    event_location: a.event_location ?? '',
    seo_title: a.seo.title ?? '',
    seo_description: a.seo.description ?? '',
    og_media_id: a.seo.og_media_id,
    canonical_url: a.seo.canonical_url ?? '',
  };
}

/**
 * Parsed form → POST/PUT body (full replace). Activity fields are cleared
 * when the chosen category is not an activity category.
 */
export function valuesToInput(
  v: ArticleFormOutput,
  opts: { withEvent: boolean },
): ArticleInput {
  const json = (v.content.json as RichTextJSON | null) ?? EMPTY_DOC;
  return {
    title: v.title,
    slug: v.slug === '' ? null : v.slug,
    excerpt: v.excerpt,
    content_json: json,
    content_html: v.content.html,
    cover_media_id: v.cover_media_id,
    cover_caption: v.cover_media_id ? v.cover_caption : null,
    category_id: v.category_id,
    author_id: v.author_id,
    tag_ids: v.tags.ids,
    new_tags: v.tags.newTags,
    is_featured: v.is_featured,
    is_breaking: v.is_breaking,
    event_date: opts.withEvent ? v.event_date : null,
    event_location: opts.withEvent ? v.event_location : null,
    seo_title: v.seo_title,
    seo_description: v.seo_description,
    og_media_id: v.og_media_id,
    canonical_url: v.canonical_url,
  };
}

function normText(s: string | null | undefined): string {
  return (s ?? '').trim();
}

/**
 * Stable comparison key for "unsaved changes". The body is compared through
 * its Tiptap JSON, never its HTML: the Go sanitizer escapes quotes in text
 * (&#34;/&#39;), so saved HTML never equals the editor's own output.
 */
export function snapshotValues(v: ArticleFormValues): string {
  return JSON.stringify({
    title: normText(v.title),
    slug: normText(v.slug),
    excerpt: normText(v.excerpt),
    content: v.content?.json ?? null,
    category_id: v.category_id ?? null,
    author_id: v.author_id ?? null,
    tags: {
      ids: [...(v.tags?.ids ?? [])].sort((a, b) => a - b),
      newTags: [...(v.tags?.newTags ?? [])].map((t) => t.trim()).sort(),
    },
    cover_media_id: v.cover_media_id ?? null,
    cover_caption: normText(v.cover_caption),
    is_featured: !!v.is_featured,
    is_breaking: !!v.is_breaking,
    event_date: v.event_date || null,
    event_location: normText(v.event_location),
    seo_title: normText(v.seo_title),
    seo_description: normText(v.seo_description),
    og_media_id: v.og_media_id ?? null,
    canonical_url: normText(v.canonical_url),
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryHit = {
  node: CategoryTreeNode;
  parent: CategoryTreeNode | null;
};

export function findCategory(
  tree: CategoryTreeNode[] | undefined,
  id: number | null | undefined,
): CategoryHit | null {
  if (!tree || !id) return null;
  for (const node of tree) {
    if (node.id === id) return { node, parent: null };
    for (const child of node.children ?? []) {
      if (child.id === id) return { node: child, parent: node };
    }
  }
  return null;
}

/**
 * Inactive categories are rejected by the API; hide them from the picker
 * unless the article already uses one (so its current value still shows).
 */
export function activeTree(
  tree: CategoryTreeNode[] | undefined,
  keepId: number | null | undefined,
): CategoryTreeNode[] {
  if (!tree) return [];
  const keep = (n: CategoryTreeNode) => n.is_active || n.id === keepId;
  return tree
    .filter((n) => keep(n) || (n.children ?? []).some((c) => c.id === keepId))
    .map((n) => ({ ...n, children: (n.children ?? []).filter(keep) }));
}

/** Activity fields are shown for "yayasan" and its sub-categories. */
export function isEventCategory(hit: CategoryHit | null): boolean {
  if (!hit) return false;
  return (
    hit.node.slug === EVENT_CATEGORY_SLUG ||
    hit.parent?.slug === EVENT_CATEGORY_SLUG
  );
}

/** Public path of an article: "/{level-1 category}/{slug}". */
export function publicPath(hit: CategoryHit | null, slug: string): string {
  const top = hit ? (hit.parent ?? hit.node).slug : 'kategori';
  return `/${top}/${slug || 'slug-artikel'}`;
}

// ---------------------------------------------------------------------------
// List sorting / statuses
// ---------------------------------------------------------------------------

export const ARTICLE_SORTS: readonly ArticleSort[] = [
  '-updated_at',
  '-published_at',
  'published_at',
  'title',
  '-title',
  '-view_count',
];

/**
 * DataTable toggles key ⇄ -key; the backend only whitelists some
 * directions (views and "updated" are descending only).
 */
export function normalizeSort(sort: string): ArticleSort {
  if ((ARTICLE_SORTS as readonly string[]).includes(sort))
    return sort as ArticleSort;
  const flipped = sort.startsWith('-') ? sort.slice(1) : `-${sort}`;
  if ((ARTICLE_SORTS as readonly string[]).includes(flipped))
    return flipped as ArticleSort;
  return '-updated_at';
}

export const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'published', label: 'Terbit' },
  { value: 'archived', label: 'Arsip' },
];

export function isArticleStatus(s: string): s is ArticleStatus {
  return STATUS_OPTIONS.some((o) => o.value === s);
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type ArticlePerms = {
  create: boolean;
  update: boolean;
  updateAny: boolean;
  publish: boolean;
  remove: boolean;
};

/** Mirrors backend canEdit: creator with articles.update, or articles.update_any. */
export function canEditArticle(
  perms: ArticlePerms,
  meId: number | null | undefined,
  createdBy: number | null | undefined,
): boolean {
  if (perms.updateAny) return true;
  return perms.update && !!meId && createdBy === meId;
}

// ---------------------------------------------------------------------------
// Publish panel
// ---------------------------------------------------------------------------

export function sameInstant(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  return Date.parse(a) === Date.parse(b);
}

export function isFuture(iso: string | null | undefined, now = Date.now()) {
  return !!iso && Date.parse(iso) > now;
}
