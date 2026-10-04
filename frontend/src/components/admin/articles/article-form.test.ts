import { describe, expect, test } from 'bun:test';

import type {
  AdminArticleDetail,
  CategoryTreeNode,
} from '@/lib/api/admin/types';

import { publishButtons } from './PublishPanel';
import {
  activeTree,
  articleSchema,
  articleToValues,
  canEditArticle,
  emptyArticleValues,
  findCategory,
  isEventCategory,
  normalizeSort,
  publicPath,
  snapshotValues,
  valuesToInput,
} from './article-form';

function node(
  id: number,
  slug: string,
  children: CategoryTreeNode[] = [],
  is_active = true,
): CategoryTreeNode {
  return {
    id,
    parent_id: null,
    name: slug,
    slug,
    description: null,
    sort_order: 0,
    is_active,
    seo_title: null,
    seo_description: null,
    article_count: 0,
    children,
  };
}

const tree = [
  node(1, 'kajian', [node(6, 'fikih'), node(9, 'lama', [], false)]),
  node(4, 'yayasan', [node(12, 'santunan')]),
];

describe('categories', () => {
  test('findCategory + event detection + public path', () => {
    const fikih = findCategory(tree, 6);
    expect(fikih?.parent?.slug).toBe('kajian');
    expect(isEventCategory(fikih)).toBe(false);
    expect(isEventCategory(findCategory(tree, 4))).toBe(true);
    expect(isEventCategory(findCategory(tree, 12))).toBe(true);
    expect(publicPath(fikih, 'x')).toBe('/kajian/x');
    expect(findCategory(tree, 999)).toBeNull();
  });

  test('activeTree hides inactive unless selected', () => {
    expect(activeTree(tree, null)[0].children.map((c) => c.id)).toEqual([6]);
    expect(activeTree(tree, 9)[0].children.map((c) => c.id)).toEqual([6, 9]);
  });
});

describe('form mapping', () => {
  const detail = {
    id: 5,
    slug: 'judul',
    title: 'Judul "kutip"',
    excerpt: null,
    url: '/kajian/judul',
    cover: null,
    category: { id: 6, name: 'Fikih', slug: 'fikih', parent: null },
    author: { id: 1, display_name: 'A', slug: 'a', title: null, avatar: null },
    published_at: null,
    reading_minutes: 1,
    event_date: '2026-09-01',
    event_location: null,
    is_featured: false,
    is_breaking: true,
    view_count: 0,
    status: 'draft',
    created_by: 1,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    category_id: 6,
    author_id: 1,
    cover_media_id: null,
    cover_caption: null,
    content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
    content_html: '<p>&#34;x&#34;</p>',
    tags: [{ id: 3, name: 't', slug: 't', url: '/tag/t' }],
    seo: {
      title: null,
      description: null,
      og_media_id: null,
      og: null,
      canonical_url: null,
    },
  } satisfies AdminArticleDetail;

  test('snapshot ignores html (sanitizer escaping) and tag order', () => {
    const a = articleToValues(detail);
    const b = {
      ...a,
      content: { json: a.content.json, html: '<p>"x"</p>' },
      tags: { ids: [...a.tags.ids], newTags: [] },
    };
    expect(snapshotValues(a)).toBe(snapshotValues(b));
    expect(snapshotValues({ ...a, title: 'Lain' })).not.toBe(snapshotValues(a));
  });

  test('valuesToInput maps empties to null and drops event fields', () => {
    const parsed = articleSchema.parse(articleToValues(detail));
    const input = valuesToInput(parsed, { withEvent: false });
    expect(input.excerpt).toBeNull();
    expect(input.event_date).toBeNull();
    expect(input.tag_ids).toEqual([3]);
    expect(input.content_json).toEqual(detail.content_json);
    expect(valuesToInput(parsed, { withEvent: true }).event_date).toBe(
      '2026-09-01',
    );
  });

  test('schema requires title and category', () => {
    const r = articleSchema.safeParse(emptyArticleValues(1));
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain('title');
    expect(paths).toContain('category_id');
  });
});

describe('sort + permissions', () => {
  test('normalizeSort keeps whitelisted directions', () => {
    expect(normalizeSort('title')).toBe('title');
    expect(normalizeSort('view_count')).toBe('-view_count');
    expect(normalizeSort('updated_at')).toBe('-updated_at');
    expect(normalizeSort('bogus')).toBe('-updated_at');
  });

  test('canEditArticle mirrors backend ownership', () => {
    const base = {
      create: true,
      update: true,
      updateAny: false,
      publish: false,
      remove: false,
    };
    expect(canEditArticle(base, 1, 1)).toBe(true);
    expect(canEditArticle(base, 1, 2)).toBe(false);
    expect(canEditArticle({ ...base, updateAny: true }, 1, 2)).toBe(true);
    expect(canEditArticle({ ...base, update: false }, 1, 1)).toBe(false);
  });
});

describe('publishButtons', () => {
  const now = Date.parse('2026-09-27T10:00:00Z');
  const future = '2026-09-28T10:00:00+07:00';
  const past = '2026-09-01T10:00:00+07:00';

  test('draft: publish now, schedule for a future time', () => {
    const b = publishButtons({
      status: 'draft',
      savedPublishedAt: null,
      publishAt: null,
      canPublish: true,
      now,
    });
    expect(b.primary).toEqual({
      kind: 'publish',
      label: 'Terbitkan',
      at: null,
    });
    expect(b.secondary?.kind).toBe('save');
    expect(
      publishButtons({
        status: null,
        savedPublishedAt: null,
        publishAt: future,
        canPublish: true,
        now,
      }).primary?.label,
    ).toBe('Jadwalkan');
  });

  test('without publish permission only saving is offered', () => {
    const b = publishButtons({
      status: 'draft',
      savedPublishedAt: null,
      publishAt: future,
      canPublish: false,
      now,
    });
    expect(b.primary?.kind).toBe('save');
    expect(b.secondary).toBeNull();
    expect(b.unpublish).toBeNull();
  });

  test('scheduled / published', () => {
    const s = publishButtons({
      status: 'scheduled',
      savedPublishedAt: future,
      publishAt: future,
      canPublish: true,
      now,
    });
    expect(s.primary?.label).toBe('Terbitkan sekarang');
    expect(s.unpublish?.kind).toBe('unpublish');
    const p = publishButtons({
      status: 'published',
      savedPublishedAt: past,
      publishAt: past,
      canPublish: true,
      now,
    });
    expect(p.primary?.kind).toBe('save');
    expect(p.secondary).toBeNull();
    const moved = publishButtons({
      status: 'published',
      savedPublishedAt: past,
      publishAt: '2026-08-01T10:00:00+07:00',
      canPublish: true,
      now,
    });
    expect(moved.secondary?.label).toBe('Ubah tanggal terbit');
  });
});
