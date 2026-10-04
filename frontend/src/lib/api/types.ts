// Types mirroring the Go public API JSON exactly (snake_case, docs/05-api.md).
// Source structs: backend/internal/{content,article,homepage,menu,site,event,
// alumni,video,page,snippet,category,tag,search,sitemap,setting,httpx}.
// Timestamps are RFC 3339 strings in WIB (+07:00); dates are "YYYY-MM-DD".

// ---------------------------------------------------------------------------
// Shared building blocks (internal/content/types.go)
// ---------------------------------------------------------------------------

export type Media = {
  id: number;
  /** Relative URL served by Go, e.g. "/uploads/2026/09/x.webp". */
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
};

/** Category reference; `parent` is set (one level only) for sub-categories. */
export type CategoryRef = {
  id: number;
  name: string;
  slug: string;
  parent: CategoryRef | null;
};

/** Public author reference on cards (never includes email). */
export type AuthorRef = {
  id: number;
  display_name: string;
  slug: string;
  title: string | null;
  avatar: Media | null;
};

export type ArticleCard = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Canonical path "/{level1-category}/{slug}". */
  url: string;
  cover: Media | null;
  category: CategoryRef;
  author: AuthorRef;
  published_at: string | null;
  reading_minutes: number;
  /** "YYYY-MM-DD" (timeline/activity articles). */
  event_date: string | null;
  event_location: string | null;
  is_featured: boolean;
  is_breaking: boolean;
  view_count: number;
};

export type EventCard = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location_name: string;
  cover: Media | null;
  /** "/agenda/{slug}". */
  url: string;
};

export type AlumniCard = {
  id: number;
  slug: string;
  name: string;
  role_title: string;
  class_year: number | null;
  short_bio: string;
  photo: Media | null;
  /** "/tokoh/{slug}". */
  url: string;
};

export type VideoCard = {
  id: number;
  slug: string;
  title: string;
  youtube_id: string;
  /** Media URL (relative) or YouTube hqdefault (https://i.ytimg.com/vi/…). */
  thumbnail_url: string;
  duration_seconds: number | null;
  view_count: number | null;
  published_at: string;
  is_featured: boolean;
  /** "/video/{slug}". */
  url: string;
};

/** Pagination block of list responses (internal/httpx/pagination.go). */
export type PageMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

// ---------------------------------------------------------------------------
// Articles, authors, tags, categories, search
// ---------------------------------------------------------------------------

export type TagRef = { id: number; name: string; slug: string; url: string };

/** Resolved SEO block of a public article (fallbacks already applied). */
export type PublicSEO = {
  title: string;
  description: string | null;
  og: Media | null;
  /** Absolute URL. */
  canonical_url: string;
};

export type ArticleDetail = ArticleCard & {
  cover_caption: string | null;
  /** Sanitized HTML (richtext.Sanitize on the server); safe for dangerouslySetInnerHTML. */
  content_html: string;
  tags: TagRef[];
  seo: PublicSEO;
  related: ArticleCard[];
  updated_at: string;
  /** True when served through a valid preview token (may be unpublished). */
  preview?: boolean;
};

/** Returned (HTTP 200) for a slug that moved; the frontend performs the 308. */
export type ArticleRedirect = { redirect: string };

export type AuthorProfile = {
  id: number;
  display_name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  avatar: Media | null;
  /** "/penulis/{slug}". */
  url: string;
};

/** Category tree node (max 2 levels); a parent's article_count includes its children. */
export type CategoryNode = {
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
  children: CategoryNode[];
};

export type CategoryDetail = CategoryNode & {
  seo: { title: string; description: string };
};

export type TagItem = {
  id: number;
  name: string;
  slug: string;
  article_count: number;
  created_at?: string;
};

export type SearchHit = ArticleCard & {
  /** HTML-escaped text where only `<mark>…</mark>` is markup; safe for dangerouslySetInnerHTML. */
  highlight: string;
};

// ---------------------------------------------------------------------------
// Events, alumni, videos, pages, snippets, sitemap
// ---------------------------------------------------------------------------

/** seo_title / seo_description pair (null when unset). */
export type SeoPair = { title: string | null; description: string | null };

export type EventDetail = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  url: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location_name: string;
  location_address: string | null;
  maps_url: string | null;
  cover: Media | null;
  registration_url: string | null;
  /** Sanitized HTML; safe for dangerouslySetInnerHTML. */
  description_html: string;
  /** "published" | "cancelled" on public reads. */
  status: string;
  seo: SeoPair;
};

export type AlumniDetail = {
  id: number;
  slug: string;
  name: string;
  role_title: string;
  class_year: number | null;
  short_bio: string;
  url: string;
  photo: Media | null;
  /** Sanitized HTML; safe for dangerouslySetInnerHTML. */
  story_html: string;
  seo: SeoPair;
};

export type VideoDetail = VideoCard & {
  description: string | null;
  embed_url: string;
  others: VideoCard[];
};

export type PageDetail = {
  title: string;
  slug: string;
  /** Sanitized HTML; safe for dangerouslySetInnerHTML. */
  content_html: string;
  seo: SeoPair;
  updated_at: string;
};

export type SnippetType = 'announcement' | 'breaking' | 'quote' | 'faq';

export type Snippet = {
  id: number;
  type: SnippetType;
  title: string | null;
  /** Sanitized inline HTML (richtext.SanitizeInline on write); usually plain text except for faq. */
  body: string;
  source: string | null;
  link_url: string | null;
};

export type SitemapEntry = {
  type:
    | 'home'
    | 'category'
    | 'article'
    | 'tag'
    | 'author'
    | 'event'
    | 'alumni'
    | 'video'
    | 'page';
  /** Relative path. */
  url: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Site (settings, menus, announcements) — internal/site, internal/setting, internal/menu
// ---------------------------------------------------------------------------

export type MenuItem = {
  id: number;
  label: string;
  href: string;
  open_new_tab: boolean;
  children?: MenuItem[];
};

export type SocialPlatform =
  | 'instagram'
  | 'youtube'
  | 'whatsapp'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'telegram'
  | 'website';

export type SiteSettings = {
  'site.identity': {
    name: string;
    tagline: string;
    logo: Media | null;
    favicon: Media | null;
  };
  /** `copyright` contains the "{year}" placeholder. */
  'site.footer': { description: string; copyright: string };
  /** `address` contains "\n" line breaks. */
  'site.contact': { address: string; email: string; phone: string };
  'site.social': { platform: SocialPlatform; url: string }[];
  'seo.defaults': {
    /** Contains "%s" (same syntax as Next's title template). */
    title_template: string;
    default_description: string;
    default_og_media_id: number | null;
    /** Hydrated media object for default_og_media_id (null when unset). */
    default_og_media: Media | null;
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

export type MenuCode =
  'header' | 'footer_categories' | 'footer_about' | 'footer_legal';

export type Announcement = {
  id: number;
  body: string;
  link_url: string | null;
};

export type SitePayload = {
  settings: Partial<SiteSettings>;
  /** Keys: header, footer_categories, footer_about, footer_legal (missing when the menu does not exist). */
  menus: Partial<Record<MenuCode, MenuItem[]>> &
    Record<string, MenuItem[] | undefined>;
  announcements: Announcement[];
};

// ---------------------------------------------------------------------------
// Homepage builder (internal/homepage/{configs,types}.go)
// ---------------------------------------------------------------------------

export type SectionBackground = 'paper' | 'ink' | 'muted';

export type SectionCommon = {
  anchor_id?: string;
  eyebrow?: string;
  title?: string;
  more_link?: { label: string; href: string };
  background?: SectionBackground;
};

export type DedupeOptions = { exclude_hero: boolean; dedupe: boolean };

export type HeroTrendingConfig = SectionCommon & {
  hero_source: 'featured' | 'latest' | 'manual';
  hero_article_id?: number;
  hero_category_slug?: string;
  trending_title: string;
  trending_window: 'day' | 'week';
  trending_limit: number;
  show_thumbnails: boolean;
};
export type HeroTrendingData = {
  hero: ArticleCard | null;
  trending: ArticleCard[];
};

export type BreakingTickerConfig = SectionCommon & {
  label: string;
  source: 'snippets' | 'articles' | 'both';
  speed_seconds: number;
  limit: number;
};
export type BreakingTickerData = {
  items: { text: string; href: string | null }[];
};

export type ArticleGridConfig = SectionCommon &
  DedupeOptions & {
    category_slug?: string;
    include_children: boolean;
    tag_slug?: string;
    columns: 2 | 3 | 4;
    limit: number;
    show_excerpt: boolean;
    show_author: boolean;
    show_reading_time: boolean;
    image_ratio: '4/3' | '16/9' | '1/1';
  };
/** Data of article_grid and timeline. */
export type ArticleListData = { items: ArticleCard[] };

export type CategoryWidgetItem = {
  name: string;
  slug: string;
  url: string;
  article_count: number;
  children?: CategoryWidgetItem[];
};
export type TagWidgetItem = {
  name: string;
  slug: string;
  url: string;
  article_count: number;
};

export type SidebarWidget = 'popular' | 'categories' | 'tags' | 'next_event';

export type LatestWithSidebarConfig = SectionCommon &
  DedupeOptions & {
    list_title: string;
    limit: number;
    category_slug?: string;
    widgets: SidebarWidget[];
    popular_limit: number;
    popular_days: number;
    tags_limit: number;
  };
/** `widgets` only contains the configured keys; `next_event` is null when nothing is upcoming. */
export type LatestWithSidebarData = {
  items: ArticleCard[];
  widgets: {
    popular?: ArticleCard[];
    categories?: CategoryWidgetItem[];
    tags?: TagWidgetItem[];
    next_event?: EventCard | null;
  };
};

export type QuoteRotatorConfig = SectionCommon & {
  interval_seconds: number;
  order: 'sequential' | 'random';
};
export type QuoteRotatorData = {
  quotes: { text: string; source: string | null }[];
};

export type TimelineConfig = SectionCommon &
  DedupeOptions & {
    category_slug?: string;
    limit: number;
    order_by: 'event_date' | 'published_at';
  };

export type FeatureSplitConfig = SectionCommon &
  DedupeOptions & {
    category_slug?: string;
    featured_label: string;
    side_limit: number;
    show_author_title: boolean;
  };
export type FeatureSplitData = {
  featured: ArticleCard | null;
  items: ArticleCard[];
};

export type PeopleGridConfig = SectionCommon & {
  limit: number;
  only_featured: boolean;
  columns: 3 | 4;
  cta_label: string;
};
export type PeopleGridData = { items: AlumniCard[] };

export type AgendaCalendarConfig = SectionCommon & {
  limit: number;
  show_calendar: boolean;
  calendar_month: 'current' | 'next_event';
};
export type CalendarDay = { day: number; slug: string; is_next: boolean };
/** `calendar` is null when show_calendar is false; `month` is "YYYY-MM" (WIB). */
export type AgendaCalendarData = {
  items: EventCard[];
  calendar: { month: string; days_with_events: CalendarDay[] } | null;
};

export type VideoGalleryConfig = SectionCommon & {
  limit: number;
  layout: 'feature' | 'grid';
};
export type VideoGalleryData = { items: VideoCard[] };

export type FaqConfig = SectionCommon & {
  default_open_index: number;
  limit?: number;
};
export type FaqData = {
  items: {
    question: string;
    /** Sanitized inline HTML (richtext.SanitizeInline); safe for dangerouslySetInnerHTML. */
    answer_html: string;
  }[];
};

export type NewsletterConfig = SectionCommon & {
  description?: string;
  button_label: string;
  placeholder: string;
};
export type NewsletterData = Record<string, never>;

export type RichTextConfig = SectionCommon & {
  /** Sanitized HTML; safe for dangerouslySetInnerHTML. */
  content_html: string;
  align: 'left' | 'center' | 'right';
  max_width: 'prose' | 'wide' | 'full';
};
export type RichTextData = {
  /** Sanitized HTML; safe for dangerouslySetInnerHTML. */
  content_html: string;
};

export type SectionType =
  | 'hero_trending'
  | 'breaking_ticker'
  | 'article_grid'
  | 'latest_with_sidebar'
  | 'quote_rotator'
  | 'timeline'
  | 'feature_split'
  | 'people_grid'
  | 'agenda_calendar'
  | 'video_gallery'
  | 'faq'
  | 'newsletter'
  | 'rich_text';

/** One entry of GET /public/homepage; `type` may be unknown to this frontend version. */
export type ResolvedSection = {
  id: number;
  type: string;
  config: SectionCommon & Record<string, unknown>;
  data: unknown;
};

export type HomepagePayload = { sections: ResolvedSection[] };
