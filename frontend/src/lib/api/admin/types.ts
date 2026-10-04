// Types mirroring the Go admin/auth API JSON exactly (snake_case).
// Sources: backend/internal/{auth/dto.go, user/dto.go, role/dto.go,
// audit/list.go, article/dto.go, category/dto.go, tag/dto.go, media/dto.go,
// event/dto.go, alumni/dto.go, video/dto.go, page/dto.go, snippet/dto.go,
// homepage/{types,registry,schema}.go, menu/dto.go, setting/keys.go,
// dashboard/dto.go, httpx/pagination.go}.
//
// Timestamps out: RFC 3339 in WIB (+07:00). Timestamps in: any RFC 3339.
// Dates: "YYYY-MM-DD". `*T` in Go → `T | null` here. Input fields tagged
// `omitempty` in Go are optional (`?`) and nullable where the Go type is a
// pointer.

import type {
  ArticleCard,
  AuthorRef,
  CategoryRef,
  EventCard,
  Media,
  MenuCode,
  SocialPlatform,
} from '@/lib/api/types';

export type {
  ArticleCard,
  AuthorRef,
  CategoryRef,
  EventCard,
  Media,
  MenuCode,
  SocialPlatform,
};

// ---------------------------------------------------------------------------
// Envelope / shared
// ---------------------------------------------------------------------------

/** httpx.Meta — present on paged lists only. */
export type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export type Paged<T> = { items: T[]; meta: ListMeta };

export type PageParams = { page?: number; per_page?: number };

/** Tiptap/ProseMirror JSON document as stored by the backend (opaque). */
export type RichTextJSON = {
  type?: string;
  content?: unknown[];
  [key: string]: unknown;
};

export type PublishStatus = 'draft' | 'published';

export type PermissionCode =
  | 'dashboard.view'
  | 'articles.read'
  | 'articles.create'
  | 'articles.update'
  | 'articles.delete'
  | 'articles.publish'
  | 'articles.update_any'
  | 'categories.manage'
  | 'tags.manage'
  | 'media.manage'
  | 'events.manage'
  | 'alumni.manage'
  | 'videos.manage'
  | 'pages.manage'
  | 'snippets.manage'
  | 'homepage.manage'
  | 'menus.manage'
  | 'authors.manage'
  | 'settings.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'audit.view';

// ---------------------------------------------------------------------------
// Auth (/auth/*)
// ---------------------------------------------------------------------------

export type RoleRef = { id: number; code: string; name: string };

/** GET /auth/me, PUT /auth/me, login/refresh `user`. */
export type Me = {
  id: number;
  email: string | null;
  display_name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  avatar_media_id: number | null;
  can_login: boolean;
  is_active: boolean;
  roles: RoleRef[];
  /** Custom roles may carry codes unknown to this build, hence `string`. */
  permissions: string[];
  last_login_at: string | null;
  created_at: string;
};

export type LoginInput = {
  email: string;
  password: string;
  remember?: boolean;
};
export type LoginResponse = { user: Me };

export type UpdateMeInput = {
  display_name: string;
  title?: string | null;
  bio?: string | null;
  avatar_media_id?: number | null;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

export type SessionInfo = {
  family_id: string;
  user_agent: string | null;
  ip: string | null;
  started_at: string;
  last_used_at: string;
  expires_at: string;
  current: boolean;
};

// ---------------------------------------------------------------------------
// Users / authors / roles / permissions / audit
// ---------------------------------------------------------------------------

export type UserItem = {
  id: number;
  email: string | null;
  display_name: string;
  slug: string;
  title: string | null;
  can_login: boolean;
  is_active: boolean;
  last_login_at: string | null;
  roles: RoleRef[];
  created_at: string;
};

export type UserDetail = UserItem & {
  bio: string | null;
  avatar_media_id: number | null;
  updated_at: string;
};

export type UserListParams = PageParams & {
  q?: string;
  can_login?: boolean;
  is_active?: boolean;
  role_code?: string;
};

export type CreateUserInput = {
  email?: string | null;
  password?: string | null;
  display_name: string;
  slug?: string | null;
  title?: string | null;
  bio?: string | null;
  avatar_media_id?: number | null;
  can_login: boolean;
  is_active?: boolean | null;
  role_ids?: number[];
};

/** PUT /users/{id}: omitted/null pointer fields keep the current value; role_ids [] clears. */
export type UpdateUserInput = {
  email?: string | null;
  password?: string | null;
  display_name: string;
  slug?: string | null;
  title?: string | null;
  bio?: string | null;
  avatar_media_id?: number | null;
  can_login?: boolean | null;
  is_active?: boolean | null;
  role_ids?: number[] | null;
};

export type ResetPasswordInput = { new_password: string };

/** GET /admin/authors (plain array). */
export type AuthorOption = {
  id: number;
  display_name: string;
  title: string | null;
  slug: string;
};

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
  permissions: string[];
  created_at: string;
};

export type CreateRoleInput = {
  /** ^[a-z][a-z0-9_]*$, max 60. Immutable afterwards. */
  code: string;
  name: string;
  description?: string | null;
  permission_codes: string[];
};

export type UpdateRoleInput = {
  name: string;
  description?: string | null;
  permission_codes: string[];
};

/** GET /admin/permissions (dbgen.Permission). */
export type Permission = { id: number; code: string; description: string };

export type AuditLog = {
  id: number;
  user: { id: number; display_name: string } | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  /** Omitted when empty. */
  changes?: unknown;
  ip: string | null;
  created_at: string;
};

export type AuditListParams = PageParams & {
  entity_type?: string;
  action?: string;
  user_id?: number;
  /** RFC 3339 or YYYY-MM-DD (WIB; date-only `to` covers the whole day). */
  from?: string;
  to?: string;
};

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export type ArticleSort =
  | '-updated_at'
  | '-published_at'
  | 'published_at'
  | 'title'
  | '-title'
  | '-view_count';

export type ArticleListParams = PageParams & {
  q?: string;
  status?: ArticleStatus;
  /** Category slug (children included). */
  category?: string;
  /** Author user id. */
  author?: number;
  trashed?: boolean;
  sort?: ArticleSort;
};

export type ArticleTagRef = {
  id: number;
  name: string;
  slug: string;
  url: string;
};

export type AdminArticleItem = ArticleCard & {
  status: ArticleStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AdminArticleSEO = {
  title: string | null;
  description: string | null;
  og_media_id: number | null;
  og: Media | null;
  canonical_url: string | null;
};

export type AdminArticleDetail = AdminArticleItem & {
  category_id: number;
  author_id: number;
  cover_media_id: number | null;
  cover_caption: string | null;
  content_json: RichTextJSON;
  content_html: string;
  tags: ArticleTagRef[];
  seo: AdminArticleSEO;
};

/** POST /articles and PUT /articles/{id} (full replace of editable fields). */
export type ArticleInput = {
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  content_json: RichTextJSON;
  content_html: string;
  cover_media_id?: number | null;
  cover_caption?: string | null;
  category_id: number;
  author_id?: number | null;
  tag_ids?: number[];
  new_tags?: string[];
  is_featured: boolean;
  is_breaking: boolean;
  /** YYYY-MM-DD */
  event_date?: string | null;
  event_location?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_media_id?: number | null;
  canonical_url?: string | null;
};

/** published_at omitted/past = now (past back-dates); future = scheduled. */
export type PublishArticleInput = { published_at?: string | null };

export type SlugCheck = {
  slug: string;
  available: boolean;
  suggestion?: string;
};

export type PreviewToken = { token: string; expires_at: string; url: string };

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

/** GET /admin/categories → tree (2 levels). */
export type CategoryTreeNode = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  article_count: number;
  children: CategoryTreeNode[];
};

export type CategoryInput = {
  parent_id?: number | null;
  name: string;
  /** Empty = auto from name. */
  slug?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type CategoryReorderItem = {
  id: number;
  parent_id: number | null;
  sort_order: number;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  article_count: number;
  created_at?: string;
};

export type TagListParams = PageParams & { q?: string };

export type TagInput = { name: string; slug?: string };

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type MediaItem = {
  id: number;
  /** Relative, e.g. "/uploads/2026/09/x.webp". */
  url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  uploaded_by: number | null;
  created_at: string;
};

export type MediaListParams = PageParams & {
  q?: string;
  /** MIME prefix; "image" is expanded to "image/". */
  type?: string;
};

export type MediaUpdateInput = {
  alt_text?: string | null;
  caption?: string | null;
};

export type MediaUploadInput = {
  file: File | Blob;
  filename?: string;
  alt_text?: string;
  caption?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Events / alumni / videos / pages / snippets
// ---------------------------------------------------------------------------

export type SeoPairNullable = {
  title: string | null;
  description: string | null;
};

export type EventStatus = 'draft' | 'published' | 'cancelled';

export type AdminEvent = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  description_json: RichTextJSON | null;
  description_html: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location_name: string;
  location_address: string | null;
  maps_url: string | null;
  cover_media_id: number | null;
  registration_url: string | null;
  status: EventStatus;
  seo: SeoPairNullable;
  created_at: string;
  updated_at: string;
};

export type EventInput = {
  title: string;
  slug?: string;
  summary?: string | null;
  description_json?: RichTextJSON | null;
  description_html?: string;
  /** RFC 3339 */
  starts_at: string;
  ends_at?: string | null;
  is_all_day: boolean;
  location_name: string;
  location_address?: string | null;
  maps_url?: string | null;
  cover_media_id?: number | null;
  registration_url?: string | null;
  status?: EventStatus;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type StatusListParams<S extends string = string> = PageParams & {
  q?: string;
  status?: S;
};

export type AdminAlumni = {
  id: number;
  name: string;
  slug: string;
  role_title: string;
  class_year: number | null;
  short_bio: string;
  story_json: RichTextJSON | null;
  story_html: string;
  photo_media_id: number | null;
  is_featured: boolean;
  sort_order: number;
  status: PublishStatus;
  seo: SeoPairNullable;
  created_at: string;
  updated_at: string;
};

export type AlumniInput = {
  name: string;
  slug?: string;
  role_title: string;
  class_year?: number | null;
  short_bio: string;
  story_json?: RichTextJSON | null;
  story_html?: string;
  photo_media_id?: number | null;
  is_featured: boolean;
  sort_order?: number;
  status?: PublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type SortOrderItem = { id: number; sort_order: number };

export type AdminVideo = {
  id: number;
  title: string;
  slug: string;
  youtube_id: string;
  description: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  thumbnail_media_id: number | null;
  published_at: string;
  is_featured: boolean;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
};

export type VideoInput = {
  title: string;
  slug?: string;
  /** Exactly 11 chars. */
  youtube_id: string;
  description?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
  thumbnail_media_id?: number | null;
  /** RFC 3339; omitted = now. */
  published_at?: string | null;
  is_featured: boolean;
  status?: PublishStatus;
};

export type ParseVideoUrlResult = { youtube_id: string; thumbnail_url: string };

/** GET /admin/pages (plain array, full items incl. content). */
export type AdminPage = {
  id: number;
  title: string;
  slug: string;
  content_json: RichTextJSON | null;
  content_html: string;
  status: PublishStatus;
  og_media_id: number | null;
  seo: SeoPairNullable;
  created_at: string;
  updated_at: string;
};

export type PageInput = {
  title: string;
  slug?: string;
  content_json?: RichTextJSON | null;
  content_html?: string;
  status?: PublishStatus;
  og_media_id?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type SnippetType = 'announcement' | 'breaking' | 'quote' | 'faq';

export type AdminSnippet = {
  id: number;
  type: SnippetType;
  title: string | null;
  /** Sanitized inline HTML (b i em strong br a[href]). */
  body: string;
  source: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SnippetInput = {
  type: SnippetType;
  title?: string | null;
  body: string;
  source?: string | null;
  link_url?: string | null;
  sort_order?: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

// ---------------------------------------------------------------------------
// Homepage builder
// ---------------------------------------------------------------------------

export type SectionXUi =
  | 'category_slug'
  | 'tag_slug'
  | 'article_id'
  | 'widgets'
  | 'richtext'
  | 'textarea';

/**
 * JSON Schema (draft-07 subset) emitted by homepage/schema.go. NOTE: Go
 * encodes map keys sorted, so `properties` arrive in ALPHABETICAL order, not
 * spec order.
 */
export type SectionFieldSchema = {
  type?: 'string' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  'x-ui'?: SectionXUi;
  /** string enum or integer enum */
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  pattern?: string;
  items?: { type: 'string'; enum?: string[] };
  uniqueItems?: boolean;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, SectionFieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
};

export type SectionSchema = SectionFieldSchema & {
  $schema?: string;
  type: 'object';
  properties: Record<string, SectionFieldSchema>;
};

export type SectionTypeInfo = {
  type: string;
  label: string;
  description: string;
  schema: SectionSchema;
  default_config: Record<string, unknown>;
};

export type HomepageSection = {
  id: number;
  type: string;
  label: string;
  position: number;
  is_active: boolean;
  config: Record<string, unknown>;
  config_valid: boolean;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateSectionInput = {
  type: string;
  label: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
};

/** All fields optional; omitted = unchanged. */
export type UpdateSectionInput = {
  label?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
};

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

export type MenuLinkType = 'url' | 'route' | 'category' | 'page' | 'anchor';

export type AdminMenuItem = {
  id: number;
  label: string;
  link_type: MenuLinkType;
  link_target: string;
  /** Resolved href. */
  href: string;
  open_new_tab: boolean;
  is_active: boolean;
  sort_order: number;
  children: AdminMenuItem[];
};

/** NOTE: the field is `name` (docs/05 says `label`). */
export type AdminMenu = { code: string; name: string; items: AdminMenuItem[] };

export type MenuItemInput = {
  label: string;
  link_type: MenuLinkType;
  link_target: string;
  open_new_tab: boolean;
  is_active: boolean;
  children?: MenuItemInput[];
};

// ---------------------------------------------------------------------------
// Settings (PUT /settings/{key} body = the raw value itself)
// ---------------------------------------------------------------------------

export type SocialLink = { platform: SocialPlatform; url: string };

export type AdminSettings = {
  'site.identity': {
    name: string;
    tagline: string;
    logo_media_id: number | null;
    favicon_media_id: number | null;
  };
  'site.footer': { description: string; copyright: string };
  'site.contact': { address: string; email: string; phone: string };
  'site.social': SocialLink[];
  'seo.defaults': {
    title_template: string;
    default_description: string;
    default_og_media_id: number | null;
    google_site_verification: string;
  };
  'header.options': {
    show_date: boolean;
    show_search: boolean;
    show_theme_toggle: boolean;
    show_login_button: boolean;
    login_label: string;
  };
};

export type SettingKey = keyof AdminSettings;

export const SETTING_KEYS: readonly SettingKey[] = [
  'site.identity',
  'site.footer',
  'site.contact',
  'site.social',
  'seo.defaults',
  'header.options',
];

/** GET /admin/settings — keys may be missing if never stored. */
export type AdminSettingsMap = Partial<AdminSettings>;

export type SettingItem<K extends SettingKey = SettingKey> = {
  key: K;
  value: AdminSettings[K];
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardPayload = {
  articles: {
    draft: number;
    scheduled: number;
    published: number;
    archived: number;
  };
  views_7d: number;
  /** 14 entries, day = YYYY-MM-DD (WIB). */
  views_daily: { day: string; views: number }[];
  top_week: (ArticleCard & { views: number })[];
  upcoming_events: EventCard[];
  recent_drafts: {
    id: number;
    title: string;
    status: ArticleStatus;
    updated_at: string;
  }[];
};
