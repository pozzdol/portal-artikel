import { describe, expect, test } from 'bun:test';

import type { SectionFieldSchema, SectionSchema } from '@/lib/api/admin/types';

import {
  COMMON_KEYS,
  FIELD_ORDER,
  buildConfig,
  buildFields,
  fieldKind,
  initialValues,
  orderKeys,
  splitServerFields,
  summarizeConfig,
  validateConfig,
} from './schema-form';

const slug = '^[a-z0-9]+(?:-[a-z0-9]+)*$';

// Shape of GET /admin/homepage/section-types → article_grid, with properties in
// the ALPHABETICAL order the Go encoder produces.
const articleGrid: SectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    anchor_id: {
      type: 'string',
      title: 'ID anchor',
      maxLength: 60,
      pattern: slug,
    },
    background: {
      type: 'string',
      title: 'Latar',
      enum: ['paper', 'ink', 'muted'],
    },
    category_slug: {
      type: 'string',
      title: 'Kategori',
      description: 'Kosong = semua kategori.',
      maxLength: 160,
      pattern: slug,
      'x-ui': 'category_slug',
    },
    columns: { type: 'integer', title: 'Kolom', enum: [2, 3, 4], default: 3 },
    dedupe: { type: 'boolean', title: 'Hindari duplikat', default: false },
    exclude_hero: {
      type: 'boolean',
      title: 'Sembunyikan artikel hero',
      default: true,
    },
    eyebrow: { type: 'string', title: 'Eyebrow', maxLength: 120 },
    image_ratio: {
      type: 'string',
      enum: ['4/3', '16/9', '1/1'],
      default: '4/3',
    },
    include_children: { type: 'boolean', default: true },
    limit: {
      type: 'integer',
      title: 'Jumlah artikel',
      minimum: 1,
      maximum: 12,
      default: 6,
    },
    more_link: {
      type: 'object',
      title: 'Tautan selengkapnya',
      additionalProperties: false,
      required: ['label', 'href'],
      properties: {
        href: { type: 'string', maxLength: 500, pattern: '^(/|#|https?://)' },
        label: { type: 'string', maxLength: 120 },
      },
    },
    show_author: { type: 'boolean', default: true },
    show_excerpt: { type: 'boolean', default: true },
    show_reading_time: { type: 'boolean', default: true },
    tag_slug: { type: 'string', pattern: slug, 'x-ui': 'tag_slug' },
    title: { type: 'string', title: 'Judul', maxLength: 200 },
  },
};

// Non-common property keys per type as served by the API (sorted).
const API_KEYS: Record<string, string[]> = {
  hero_trending: [
    'hero_article_id',
    'hero_category_slug',
    'hero_source',
    'show_thumbnails',
    'trending_limit',
    'trending_title',
    'trending_window',
  ],
  breaking_ticker: ['label', 'limit', 'source', 'speed_seconds'],
  article_grid: [
    'category_slug',
    'columns',
    'dedupe',
    'exclude_hero',
    'image_ratio',
    'include_children',
    'limit',
    'show_author',
    'show_excerpt',
    'show_reading_time',
    'tag_slug',
  ],
  latest_with_sidebar: [
    'category_slug',
    'dedupe',
    'exclude_hero',
    'limit',
    'list_title',
    'popular_days',
    'popular_limit',
    'tags_limit',
    'widgets',
  ],
  quote_rotator: ['interval_seconds', 'order'],
  timeline: ['category_slug', 'dedupe', 'exclude_hero', 'limit', 'order_by'],
  feature_split: [
    'category_slug',
    'dedupe',
    'exclude_hero',
    'featured_label',
    'show_author_title',
    'side_limit',
  ],
  people_grid: ['columns', 'cta_label', 'limit', 'only_featured'],
  agenda_calendar: ['calendar_month', 'limit', 'show_calendar'],
  video_gallery: ['layout', 'limit'],
  faq: ['default_open_index', 'limit'],
  newsletter: ['button_label', 'description', 'placeholder'],
  rich_text: ['align', 'content_html', 'max_width'],
};

describe('FIELD_ORDER', () => {
  test('covers exactly the API keys of all 13 types', () => {
    expect(Object.keys(FIELD_ORDER).sort()).toEqual(
      Object.keys(API_KEYS).sort(),
    );
    for (const [type, keys] of Object.entries(API_KEYS)) {
      expect([...FIELD_ORDER[type]].sort()).toEqual(keys);
    }
  });
});

describe('fieldKind', () => {
  const cases: [SectionFieldSchema, string][] = [
    [{ type: 'string', 'x-ui': 'category_slug' }, 'category'],
    [{ type: 'string', 'x-ui': 'tag_slug' }, 'tag'],
    [{ type: 'integer', 'x-ui': 'article_id' }, 'article'],
    [
      {
        type: 'array',
        'x-ui': 'widgets',
        items: { type: 'string', enum: ['a'] },
      },
      'widgets',
    ],
    [{ type: 'array', items: { type: 'string', enum: ['a'] } }, 'widgets'],
    [{ type: 'array', items: { type: 'string' } }, 'unsupported'],
    [{ type: 'string', 'x-ui': 'richtext' }, 'richtext'],
    [{ type: 'string', 'x-ui': 'textarea' }, 'textarea'],
    [{ type: 'boolean' }, 'switch'],
    [{ type: 'string', enum: ['a', 'b'] }, 'select'],
    [{ type: 'integer', enum: [2, 3] }, 'segmented'],
    [{ type: 'integer', minimum: 1 }, 'number'],
    [{ type: 'string' }, 'text'],
    [{ type: 'object', properties: { a: { type: 'string' } } }, 'object'],
    [{}, 'unsupported'],
  ];
  for (const [schema, kind] of cases) {
    test(`${JSON.stringify(schema)} → ${kind}`, () => {
      expect(fieldKind(schema)).toBe(kind as ReturnType<typeof fieldKind>);
    });
  }
});

describe('buildFields', () => {
  const fields = buildFields('article_grid', articleGrid);

  test('common keys first, then spec order (not alphabetical)', () => {
    expect(fields.map((f) => f.name)).toEqual([
      ...COMMON_KEYS,
      ...FIELD_ORDER.article_grid,
    ]);
    expect(
      fields.filter((f) => f.group === 'common').map((f) => f.name),
    ).toEqual([...COMMON_KEYS]);
  });

  test('nested more_link ordered label, href and required', () => {
    const ml = fields.find((f) => f.name === 'more_link')!;
    expect(ml.kind).toBe('object');
    expect(ml.children!.map((c) => [c.path, c.required])).toEqual([
      ['more_link.label', true],
      ['more_link.href', true],
    ]);
  });

  test('unknown keys are appended alphabetically', () => {
    const schema: SectionSchema = {
      type: 'object',
      properties: {
        zeta: { type: 'string' },
        alpha: { type: 'boolean' },
        limit: { type: 'integer' },
        layout: { type: 'string', enum: ['feature', 'grid'] },
      },
    };
    expect(buildFields('video_gallery', schema).map((f) => f.name)).toEqual([
      'limit',
      'layout',
      'alpha',
      'zeta',
    ]);
    expect(orderKeys(['b', 'a'], [])).toEqual(['a', 'b']);
  });

  test('labels come from title, falling back to the key', () => {
    expect(fields.find((f) => f.name === 'limit')!.label).toBe(
      'Jumlah artikel',
    );
    expect(fields.find((f) => f.name === 'image_ratio')!.label).toBe(
      'image_ratio',
    );
  });
});

describe('values → config', () => {
  const fields = buildFields('article_grid', articleGrid);

  test('seeds from config then defaults', () => {
    const v = initialValues(fields, { category_slug: 'kajian', columns: 4 });
    expect(v.category_slug).toBe('kajian');
    expect(v.columns).toBe(4);
    expect(v.limit).toBe(6);
    expect(v.exclude_hero).toBe(true);
    expect(v.tag_slug).toBeNull();
    expect(v.more_link).toEqual({ label: null, href: null });
  });

  test('omits empty values and unknown keys', () => {
    const v = initialValues(fields, { category_slug: 'prestasi', bogus: 1 });
    v.eyebrow = '   ';
    v.limit = Number.NaN;
    const cfg = buildConfig(fields, v);
    expect(cfg).not.toHaveProperty('bogus');
    expect(cfg).not.toHaveProperty('eyebrow');
    expect(cfg).not.toHaveProperty('limit');
    expect(cfg).not.toHaveProperty('more_link');
    expect(cfg).not.toHaveProperty('tag_slug');
    expect(cfg.category_slug).toBe('prestasi');
    expect(cfg.dedupe).toBe(false);
    expect(cfg.columns).toBe(3);
  });

  test('keeps a filled more_link and trims strings', () => {
    const v = initialValues(fields, {});
    v.more_link = { label: ' Lihat ', href: '/kategori/prestasi' };
    expect(buildConfig(fields, v).more_link).toEqual({
      label: 'Lihat',
      href: '/kategori/prestasi',
    });
  });
});

describe('validateConfig', () => {
  const fields = buildFields('article_grid', articleGrid);

  test('bounds, pattern and half-filled more_link', () => {
    const v = initialValues(fields, {});
    v.limit = 20;
    v.anchor_id = 'Bukan Slug';
    v.more_link = { label: 'Lihat', href: 'kategori' };
    expect(validateConfig(fields, v)).toEqual({
      'config.limit': 'Maksimal 12.',
      'config.anchor_id': 'Hanya huruf kecil, angka, dan tanda hubung.',
      'config.more_link.href': 'Tautan harus diawali /, # atau http(s)://.',
    });
    v.more_link = { label: 'Lihat', href: null };
    v.limit = 3;
    v.anchor_id = null;
    expect(validateConfig(fields, v)).toEqual({
      'config.more_link.href': 'Wajib diisi.',
    });
  });

  test('empty more_link is fine', () => {
    expect(validateConfig(fields, initialValues(fields, {}))).toEqual({});
  });
});

test('splitServerFields', () => {
  expect(splitServerFields({ 'config.limit': 'x', label: 'y' })).toEqual({
    config: { 'config.limit': 'x' },
    other: { label: 'y' },
  });
});

test('summarizeConfig', () => {
  expect(
    summarizeConfig('article_grid', {
      category_slug: 'kajian',
      columns: 3,
      limit: 6,
      anchor_id: 'kajian',
    }),
  ).toEqual(['Kategori kajian', '3 kolom', '6 artikel', '#kajian']);
  expect(summarizeConfig('faq', {})).toEqual(['Semua pertanyaan']);
});
