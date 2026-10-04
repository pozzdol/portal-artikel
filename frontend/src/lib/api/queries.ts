import 'server-only';

import { cache } from 'react';

import { apiFetch, apiGet, apiList } from './server';
import type {
  AlumniCard,
  AlumniDetail,
  ArticleCard,
  ArticleDetail,
  ArticleRedirect,
  AuthorProfile,
  CategoryDetail,
  CategoryNode,
  EventCard,
  EventDetail,
  HomepagePayload,
  PageDetail,
  PageMeta,
  SearchHit,
  SitemapEntry,
  SitePayload,
  Snippet,
  SnippetType,
  TagItem,
  VideoCard,
  VideoDetail,
} from './types';

// Typed wrappers around the public API. The tag names are the contract with
// the backend revalidation client (backend/internal/revalidate/tags.go,
// docs/03 §4.2): every tag the backend enqueues for a change must be attached
// to the fetches whose output that change affects.

/** Short safety-net TTL for fast-moving data (homepage, trending, popular). */
const SHORT_TTL = 300;

const enc = encodeURIComponent;

export type Paged<T> = { items: T[]; meta: PageMeta };

// --- site & homepage --------------------------------------------------------

/** GET /public/site — settings, menus and announcements for the layout. */
export const getSite = cache((): Promise<SitePayload> =>
  apiGet<SitePayload>('/public/site', {
    tags: ['settings', 'menus', 'snippets'],
  }),
);

/** GET /public/homepage — active sections with resolved data. */
export function getHomepage(): Promise<HomepagePayload> {
  return apiGet<HomepagePayload>('/public/homepage', {
    tags: ['homepage', 'settings', 'snippets', 'trending'],
    revalidate: SHORT_TTL,
  });
}

// --- articles ---------------------------------------------------------------

export type ArticleResult =
  | { kind: 'article'; article: ArticleDetail }
  | { kind: 'redirect'; to: string };

function toArticleResult(data: ArticleDetail | ArticleRedirect): ArticleResult {
  if ('redirect' in data && typeof data.redirect === 'string') {
    return { kind: 'redirect', to: data.redirect };
  }
  return { kind: 'article', article: data as ArticleDetail };
}

/**
 * GET /public/articles/{slug}. Returns a redirect result for moved slugs; the
 * caller must `permanentRedirect(result.to)` outside any try/catch.
 * Unknown slug → notFound().
 */
export const getArticle = cache(
  async (slug: string): Promise<ArticleResult> => {
    const data = await apiGet<ArticleDetail | ArticleRedirect>(
      `/public/articles/${enc(slug)}`,
      {
        tags: [`article:${slug}`],
      },
    );
    return toArticleResult(data);
  },
);

/** GET /public/articles/{slug}?preview={token} — never cached. Invalid token → notFound(). */
export async function getArticlePreview(
  slug: string,
  token: string,
): Promise<ArticleResult> {
  const data = await apiGet<ArticleDetail | ArticleRedirect>(
    `/public/articles/${enc(slug)}`,
    {
      noStore: true,
      query: { preview: token },
    },
  );
  return toArticleResult(data);
}

export type ListArticlesParams = {
  /** Category slug (includes active children). */
  category?: string;
  tag?: string;
  /** Author slug. */
  author?: string;
  featured?: boolean;
  page?: number;
  per_page?: number;
};

/** GET /public/articles — paginated published article cards. */
export function listArticles(
  params: ListArticlesParams = {},
): Promise<Paged<ArticleCard>> {
  // Every article publish/update enqueues `homepage`, so it covers the
  // unfiltered and featured lists; filtered lists add their specific tag.
  const tags = ['homepage'];
  if (params.category) tags.push(`category:${params.category}`);
  if (params.tag) tags.push(`tag:${params.tag}`);
  if (params.author) tags.push(`author:${params.author}`);
  return apiList<ArticleCard>('/public/articles', {
    tags,
    query: {
      category: params.category,
      tag: params.tag,
      author: params.author,
      featured: params.featured,
      page: params.page,
      per_page: params.per_page,
    },
  });
}

/** GET /public/articles/trending?window=&limit= */
export function getTrending(
  window: 'day' | 'week' = 'day',
  limit = 5,
): Promise<ArticleCard[]> {
  return apiGet<ArticleCard[]>('/public/articles/trending', {
    tags: ['trending'],
    revalidate: SHORT_TTL,
    query: { window, limit },
  });
}

/** GET /public/articles/popular?days=&limit= */
export function getPopular(days = 30, limit = 5): Promise<ArticleCard[]> {
  return apiGet<ArticleCard[]>('/public/articles/popular', {
    tags: ['trending'],
    revalidate: SHORT_TTL,
    query: { days, limit },
  });
}

/** GET /public/search — never cached. `fallback` = typo-tolerant title search was used. */
export async function search(
  q: string,
  page = 1,
  perPage?: number,
): Promise<{ items: SearchHit[]; meta: PageMeta; fallback: boolean }> {
  const { data, meta, headers } = await apiFetch<SearchHit[]>(
    '/public/search',
    {
      noStore: true,
      query: { q, page, per_page: perPage },
    },
  );
  const items = data ?? [];
  return {
    items,
    meta: meta ?? {
      page,
      per_page: items.length,
      total: items.length,
      total_pages: items.length ? 1 : 0,
    },
    fallback: headers.get('x-search-fallback') === 'true',
  };
}

// --- taxonomy & authors -----------------------------------------------------

/** GET /public/categories/{slug} */
export function getCategory(slug: string): Promise<CategoryDetail> {
  return apiGet<CategoryDetail>(`/public/categories/${enc(slug)}`, {
    tags: [`category:${slug}`, 'menus'],
  });
}

/** GET /public/categories — active category tree. */
export function getCategoryTree(): Promise<CategoryNode[]> {
  return apiGet<CategoryNode[]>('/public/categories', {
    tags: ['menus', 'homepage'],
  });
}

/** GET /public/tags/{slug} */
export function getTag(slug: string): Promise<TagItem> {
  return apiGet<TagItem>(`/public/tags/${enc(slug)}`, {
    tags: [`tag:${slug}`],
  });
}

/** GET /public/tags?popular=true&limit= */
export function getPopularTags(limit = 10): Promise<TagItem[]> {
  return apiGet<TagItem[]>('/public/tags', {
    tags: ['homepage'],
    revalidate: SHORT_TTL,
    query: { popular: true, limit },
  });
}

/** GET /public/authors/{slug} */
export function getAuthor(slug: string): Promise<AuthorProfile> {
  return apiGet<AuthorProfile>(`/public/authors/${enc(slug)}`, {
    tags: [`author:${slug}`],
  });
}

// --- events, alumni, videos, pages, snippets --------------------------------

export type ListEventsParams = {
  when?: 'upcoming' | 'past';
  /** "YYYY-MM" (WIB). */
  month?: string;
  page?: number;
  per_page?: number;
};

/** GET /public/events */
export function listEvents(
  params: ListEventsParams = {},
): Promise<Paged<EventCard>> {
  return apiList<EventCard>('/public/events', {
    tags: ['events'],
    query: {
      when: params.when,
      month: params.month,
      page: params.page,
      per_page: params.per_page,
    },
  });
}

/** GET /public/events/{slug} */
export function getEvent(slug: string): Promise<EventDetail> {
  return apiGet<EventDetail>(`/public/events/${enc(slug)}`, {
    tags: [`event:${slug}`, 'events'],
  });
}

export type ListAlumniParams = {
  featured?: boolean;
  page?: number;
  per_page?: number;
};

/** GET /public/alumni */
export function listAlumni(
  params: ListAlumniParams = {},
): Promise<Paged<AlumniCard>> {
  return apiList<AlumniCard>('/public/alumni', {
    tags: ['alumni'],
    query: {
      featured: params.featured,
      page: params.page,
      per_page: params.per_page,
    },
  });
}

/** GET /public/alumni/{slug} */
export function getAlumni(slug: string): Promise<AlumniDetail> {
  return apiGet<AlumniDetail>(`/public/alumni/${enc(slug)}`, {
    tags: [`alumni:${slug}`, 'alumni'],
  });
}

export type ListVideosParams = { page?: number; per_page?: number };

/** GET /public/videos */
export function listVideos(
  params: ListVideosParams = {},
): Promise<Paged<VideoCard>> {
  return apiList<VideoCard>('/public/videos', {
    tags: ['videos'],
    query: { page: params.page, per_page: params.per_page },
  });
}

/** GET /public/videos/{slug} */
export function getVideo(slug: string): Promise<VideoDetail> {
  return apiGet<VideoDetail>(`/public/videos/${enc(slug)}`, {
    tags: [`video:${slug}`, 'videos'],
  });
}

/** GET /public/pages/{slug} */
export function getPage(slug: string): Promise<PageDetail> {
  return apiGet<PageDetail>(`/public/pages/${enc(slug)}`, {
    tags: [`page:${slug}`],
  });
}

/** GET /public/snippets?type= — active snippets of one type. */
export function getSnippets(type: SnippetType): Promise<Snippet[]> {
  return apiGet<Snippet[]>('/public/snippets', {
    tags: ['snippets'],
    query: { type },
  });
}

/** GET /public/sitemap — every public URL with its last update. */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const { entries } = await apiGet<{ entries: SitemapEntry[] }>(
    '/public/sitemap',
    { tags: ['sitemap'] },
  );
  return entries;
}
