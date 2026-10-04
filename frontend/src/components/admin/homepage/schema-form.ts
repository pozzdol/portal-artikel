// Pure helpers behind SectionConfigForm: turn a section type's JSON Schema
// (GET /admin/homepage/section-types) into an ordered list of form fields,
// seed values, validate lightly on the client and build the config payload.
//
// The Go API encodes `schema.properties` (and `default_config`) with sorted map
// keys, so the natural field order is lost in transit. FIELD_ORDER mirrors the
// spec order in backend/internal/homepage/spec.go (commonFields first, then the
// type's own fields incl. dedupe switches). Unknown/new schema keys are
// appended alphabetically so a backend addition still renders.

import type { SectionFieldSchema, SectionSchema } from '@/lib/api/admin/types';

/** Keys every section type accepts; rendered in the collapsible "Umum" group. */
export const COMMON_KEYS = [
  'anchor_id',
  'eyebrow',
  'title',
  'more_link',
  'background',
] as const;

const DEDUPE = ['exclude_hero', 'dedupe'];

/** Per-type field order (without the common keys), mirroring spec.go. */
export const FIELD_ORDER: Record<string, readonly string[]> = {
  hero_trending: [
    'hero_source',
    'hero_article_id',
    'hero_category_slug',
    'trending_title',
    'trending_window',
    'trending_limit',
    'show_thumbnails',
  ],
  breaking_ticker: ['label', 'source', 'speed_seconds', 'limit'],
  article_grid: [
    'category_slug',
    'include_children',
    'tag_slug',
    'columns',
    'limit',
    'show_excerpt',
    'show_author',
    'show_reading_time',
    'image_ratio',
    ...DEDUPE,
  ],
  latest_with_sidebar: [
    'list_title',
    'limit',
    'category_slug',
    'widgets',
    'popular_limit',
    'popular_days',
    'tags_limit',
    ...DEDUPE,
  ],
  quote_rotator: ['interval_seconds', 'order'],
  timeline: ['category_slug', 'limit', 'order_by', ...DEDUPE],
  feature_split: [
    'category_slug',
    'featured_label',
    'side_limit',
    'show_author_title',
    ...DEDUPE,
  ],
  people_grid: ['limit', 'only_featured', 'columns', 'cta_label'],
  agenda_calendar: ['limit', 'show_calendar', 'calendar_month'],
  video_gallery: ['limit', 'layout'],
  faq: ['default_open_index', 'limit'],
  newsletter: ['description', 'button_label', 'placeholder'],
  rich_text: ['content_html', 'align', 'max_width'],
};

/** Order of the nested more_link fields (spec.go). */
const NESTED_ORDER: Record<string, readonly string[]> = {
  more_link: ['label', 'href'],
};

export type FieldKind =
  | 'category'
  | 'tag'
  | 'article'
  | 'widgets'
  | 'richtext'
  | 'textarea'
  | 'switch'
  | 'select'
  | 'segmented'
  | 'number'
  | 'text'
  | 'object'
  | 'unsupported';

export type FormField = {
  name: string;
  /** Dotted path used for values/errors, e.g. "more_link.label". */
  path: string;
  kind: FieldKind;
  schema: SectionFieldSchema;
  label: string;
  description?: string;
  required: boolean;
  group: 'common' | 'specific';
  /** Nested fields of an object (more_link). */
  children?: FormField[];
};

/** Maps one JSON Schema property to the control that edits it (plan §1.9). */
export function fieldKind(s: SectionFieldSchema): FieldKind {
  switch (s['x-ui']) {
    case 'category_slug':
      return 'category';
    case 'tag_slug':
      return 'tag';
    case 'article_id':
      return 'article';
    case 'widgets':
      return 'widgets';
    case 'richtext':
      return 'richtext';
    case 'textarea':
      return 'textarea';
  }
  switch (s.type) {
    case 'boolean':
      return 'switch';
    case 'string':
      return s.enum?.length ? 'select' : 'text';
    case 'integer':
      return s.enum?.length ? 'segmented' : 'number';
    case 'object':
      return s.properties ? 'object' : 'unsupported';
    case 'array':
      // Enum arrays without a hint still get the orderable checklist.
      return s.items?.enum?.length ? 'widgets' : 'unsupported';
    default:
      return 'unsupported';
  }
}

/** Orders `keys` by `preferred`, appending the rest alphabetically. */
export function orderKeys(
  keys: readonly string[],
  preferred: readonly string[],
): string[] {
  const set = new Set(keys);
  const head = preferred.filter((k) => set.has(k));
  const seen = new Set(head);
  const tail = keys.filter((k) => !seen.has(k)).sort();
  return [...head, ...tail];
}

function toField(
  name: string,
  schema: SectionFieldSchema,
  parentPath: string,
  required: boolean,
  group: FormField['group'],
): FormField {
  const path = parentPath ? `${parentPath}.${name}` : name;
  const kind = fieldKind(schema);
  const field: FormField = {
    name,
    path,
    kind,
    schema,
    label: schema.title ?? name,
    description: schema.description,
    required,
    group,
  };
  if (kind === 'object' && schema.properties) {
    const req = new Set(schema.required ?? []);
    field.children = orderKeys(
      Object.keys(schema.properties),
      NESTED_ORDER[name] ?? [],
    ).map((k) => toField(k, schema.properties![k], path, req.has(k), group));
  }
  return field;
}

/** All fields of a type's schema, common keys first, in spec order. */
export function buildFields(type: string, schema: SectionSchema): FormField[] {
  const props = schema.properties ?? {};
  const keys = Object.keys(props);
  const common = new Set<string>(COMMON_KEYS);
  const ordered = orderKeys(keys, [
    ...COMMON_KEYS,
    ...(FIELD_ORDER[type] ?? []),
  ]);
  const req = new Set(schema.required ?? []);
  return ordered.map((k) =>
    toField(k, props[k], '', req.has(k), common.has(k) ? 'common' : 'specific'),
  );
}

export type ConfigValues = Record<string, unknown>;

function isEmpty(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (typeof v === 'number' && !Number.isFinite(v))
  );
}

function seed(field: FormField, raw: unknown): unknown {
  if (field.kind === 'object') {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as ConfigValues;
    const out: ConfigValues = {};
    for (const c of field.children ?? []) out[c.name] = seed(c, obj[c.name]);
    return out;
  }
  const v = raw === undefined ? field.schema.default : raw;
  if (field.kind === 'widgets') return Array.isArray(v) ? [...v] : [];
  if (field.kind === 'switch') return typeof v === 'boolean' ? v : false;
  return v ?? null;
}

/** Form values from a stored config, falling back to schema defaults. */
export function initialValues(
  fields: FormField[],
  config: ConfigValues | null | undefined,
): ConfigValues {
  const src = config ?? {};
  const out: ConfigValues = {};
  for (const f of fields) out[f.name] = seed(f, src[f.name]);
  return out;
}

function pack(field: FormField, v: unknown): unknown {
  if (field.kind === 'object') {
    const obj = (v ?? {}) as ConfigValues;
    const out: ConfigValues = {};
    for (const c of field.children ?? []) {
      const cv = pack(c, obj[c.name]);
      if (cv !== undefined) out[c.name] = cv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (isEmpty(v)) return undefined;
  if (typeof v === 'string') return v.trim();
  return v;
}

/**
 * The config payload: only schema keys, empty values omitted so server
 * defaults apply (plan §1.9). Unknown keys from a stale config are dropped.
 */
export function buildConfig(
  fields: FormField[],
  values: ConfigValues,
): ConfigValues {
  const out: ConfigValues = {};
  for (const f of fields) {
    const v = pack(f, values[f.name]);
    if (v !== undefined) out[f.name] = v;
  }
  return out;
}

/** Client-side checks mirroring registry.go; keys are "config.<path>". */
export function validateConfig(
  fields: FormField[],
  values: ConfigValues,
): Record<string, string> {
  const errs: Record<string, string> = {};
  const walk = (list: FormField[], vals: ConfigValues) => {
    for (const f of list) {
      const v = vals[f.name];
      const key = `config.${f.path}`;
      const s = f.schema;
      if (f.kind === 'object') {
        const obj = (v ?? {}) as ConfigValues;
        const filled = (f.children ?? []).some((c) => !isEmpty(obj[c.name]));
        if (filled) walk(f.children ?? [], obj);
        continue;
      }
      if (isEmpty(v)) {
        if (f.required) errs[key] = 'Wajib diisi.';
        continue;
      }
      if (typeof v === 'string') {
        const t = v.trim();
        if (s.maxLength != null && t.length > s.maxLength)
          errs[key] = `Maksimal ${s.maxLength} karakter.`;
        else if (s.pattern && !new RegExp(s.pattern).test(t))
          errs[key] = patternMessage(s.pattern);
      } else if (typeof v === 'number') {
        if (!Number.isInteger(v)) errs[key] = 'Harus berupa bilangan bulat.';
        else if (s.minimum != null && v < s.minimum)
          errs[key] = `Minimal ${s.minimum}.`;
        else if (s.maximum != null && v > s.maximum)
          errs[key] = `Maksimal ${s.maximum}.`;
      } else if (Array.isArray(v)) {
        if (s.maxItems != null && v.length > s.maxItems)
          errs[key] = `Maksimal ${s.maxItems} item.`;
        else if (s.minItems != null && v.length < s.minItems)
          errs[key] = `Minimal ${s.minItems} item.`;
      }
    }
  };
  walk(fields, values);
  return errs;
}

function patternMessage(pattern: string): string {
  if (pattern.startsWith('^(/|#|https?'))
    return 'Tautan harus diawali /, # atau http(s)://.';
  if (pattern.startsWith('^[a-z0-9]'))
    return 'Hanya huruf kecil, angka, dan tanda hubung.';
  return 'Format tidak valid.';
}

/**
 * Server 422 fields → form error map. Keeps "config.*" keys as-is; other keys
 * (e.g. "label") are returned separately.
 */
export function splitServerFields(fields: Record<string, string> | undefined): {
  config: Record<string, string>;
  other: Record<string, string>;
} {
  const config: Record<string, string> = {};
  const other: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (k.startsWith('config.')) config[k] = v;
    else other[k] = v;
  }
  return { config, other };
}

/** Human labels for enum values shown in Select / ToggleGroup. */
export const ENUM_LABELS: Record<string, string> = {
  paper: 'Terang',
  ink: 'Gelap',
  muted: 'Abu-abu',
  featured: 'Artikel unggulan',
  latest: 'Artikel terbaru',
  manual: 'Pilih manual',
  day: 'Hari ini',
  week: 'Sepekan',
  snippets: 'Snippet breaking',
  articles: 'Artikel breaking',
  both: 'Keduanya',
  sequential: 'Berurutan',
  random: 'Acak',
  event_date: 'Tanggal kegiatan',
  published_at: 'Tanggal terbit',
  current: 'Bulan ini',
  next_event: 'Bulan agenda berikutnya',
  feature: 'Satu besar + kecil',
  grid: 'Grid rata',
  left: 'Kiri',
  center: 'Tengah',
  right: 'Kanan',
  prose: 'Sempit (teks)',
  wide: 'Lebar',
  full: 'Penuh',
  '4/3': '4:3',
  '16/9': '16:9',
  '1/1': '1:1',
};

/** Labels for latest_with_sidebar widgets. */
export const WIDGET_LABELS: Record<string, string> = {
  popular: 'Terpopuler',
  categories: 'Kategori',
  tags: 'Tag',
  next_event: 'Agenda berikutnya',
};

export function enumLabel(v: string | number): string {
  return ENUM_LABELS[String(v)] ?? String(v);
}

/** Short config facts for the list row (at most 3). */
export function summarizeConfig(type: string, c: ConfigValues): string[] {
  const out: string[] = [];
  const cat = typeof c.category_slug === 'string' ? c.category_slug : null;
  const num = (k: string) =>
    typeof c[k] === 'number' ? (c[k] as number) : null;
  switch (type) {
    case 'hero_trending':
      out.push(
        `Hero: ${enumLabel(String(c.hero_source ?? 'featured')).toLowerCase()}`,
      );
      if (num('trending_limit')) out.push(`${num('trending_limit')} trending`);
      break;
    case 'breaking_ticker':
      if (c.source) out.push(enumLabel(String(c.source)));
      if (num('limit')) out.push(`${num('limit')} item`);
      break;
    case 'article_grid':
      out.push(cat ? `Kategori ${cat}` : 'Semua kategori');
      if (typeof c.tag_slug === 'string') out.push(`Tag ${c.tag_slug}`);
      if (num('columns')) out.push(`${num('columns')} kolom`);
      if (num('limit')) out.push(`${num('limit')} artikel`);
      break;
    case 'latest_with_sidebar':
      out.push(cat ? `Kategori ${cat}` : 'Semua kategori');
      if (Array.isArray(c.widgets)) out.push(`${c.widgets.length} widget`);
      break;
    case 'timeline':
    case 'feature_split':
      if (cat) out.push(`Kategori ${cat}`);
      if (num('limit') ?? num('side_limit'))
        out.push(`${num('limit') ?? num('side_limit')} artikel`);
      break;
    case 'people_grid':
      if (num('limit')) out.push(`${num('limit')} tokoh`);
      if (c.only_featured) out.push('Hanya unggulan');
      break;
    case 'agenda_calendar':
      if (num('limit')) out.push(`${num('limit')} agenda`);
      out.push(
        c.show_calendar === false ? 'Tanpa kalender' : 'Dengan kalender',
      );
      break;
    case 'video_gallery':
      if (num('limit')) out.push(`${num('limit')} video`);
      if (c.layout) out.push(enumLabel(String(c.layout)));
      break;
    case 'quote_rotator':
      if (num('interval_seconds'))
        out.push(`Ganti tiap ${num('interval_seconds')} detik`);
      break;
    case 'faq':
      out.push(
        num('limit') ? `Maks. ${num('limit')} pertanyaan` : 'Semua pertanyaan',
      );
      break;
    case 'rich_text':
      if (c.max_width)
        out.push(`Lebar ${enumLabel(String(c.max_width)).toLowerCase()}`);
      break;
  }
  if (typeof c.anchor_id === 'string' && c.anchor_id)
    out.push(`#${c.anchor_id}`);
  return out.slice(0, 4);
}
