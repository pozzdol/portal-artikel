// React Query key factory for the admin CMS. Every key starts with
// ['admin', <family>] so a whole family can be invalidated with
// `queryClient.invalidateQueries({ queryKey: qk.<family>.all })`.
//
// Shape: [ 'admin', family, kind, ...args ]
//   lists:   ['admin','articles','list', params]
//   detail:  ['admin','articles','detail', id]

import type {
  ArticleListParams,
  AuditListParams,
  MediaListParams,
  StatusListParams,
  TagListParams,
  UserListParams,
} from './types';

/** Drops undefined/''/null so equivalent param objects share a cache entry. */
export function cleanParams<T extends object>(params?: T): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!params) return out as Partial<T>;
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

function resource<P extends object>(family: string) {
  const all = ['admin', family] as const;
  return {
    all,
    lists: () => [...all, 'list'] as const,
    list: (params?: P) => [...all, 'list', cleanParams(params)] as const,
    details: () => [...all, 'detail'] as const,
    detail: (id: number) => [...all, 'detail', id] as const,
  };
}

export const qk = {
  all: ['admin'] as const,

  auth: {
    all: ['admin', 'auth'] as const,
    me: () => ['admin', 'auth', 'me'] as const,
    sessions: () => ['admin', 'auth', 'sessions'] as const,
  },

  dashboard: {
    all: ['admin', 'dashboard'] as const,
    get: () => ['admin', 'dashboard', 'get'] as const,
  },

  articles: {
    ...resource<ArticleListParams>('articles'),
    slugCheck: (slug: string, excludeId?: number) =>
      ['admin', 'articles', 'slug-check', slug, excludeId ?? 0] as const,
  },

  categories: {
    all: ['admin', 'categories'] as const,
    tree: () => ['admin', 'categories', 'tree'] as const,
    publicTree: () => ['admin', 'categories', 'public-tree'] as const,
  },

  tags: {
    ...resource<TagListParams>('tags'),
    publicList: (q?: string) =>
      ['admin', 'tags', 'public-list', q ?? ''] as const,
  },

  media: {
    ...resource<MediaListParams>('media'),
    /** ids are sorted + de-duplicated by the hook before building the key. */
    byIds: (ids: readonly number[]) =>
      ['admin', 'media', 'by-ids', ids.join(',')] as const,
  },

  events: resource<StatusListParams>('events'),
  alumni: resource<StatusListParams>('alumni'),
  videos: resource<StatusListParams>('videos'),

  pages: {
    all: ['admin', 'pages'] as const,
    list: () => ['admin', 'pages', 'list'] as const,
    detail: (id: number) => ['admin', 'pages', 'detail', id] as const,
  },

  snippets: {
    all: ['admin', 'snippets'] as const,
    lists: () => ['admin', 'snippets', 'list'] as const,
    /** type '' = all types. */
    list: (type?: string) => ['admin', 'snippets', 'list', type ?? ''] as const,
    detail: (id: number) => ['admin', 'snippets', 'detail', id] as const,
  },

  homepage: {
    all: ['admin', 'homepage'] as const,
    sectionTypes: () => ['admin', 'homepage', 'section-types'] as const,
    sections: () => ['admin', 'homepage', 'sections'] as const,
  },

  menus: {
    all: ['admin', 'menus'] as const,
    list: () => ['admin', 'menus', 'list'] as const,
    detail: (code: string) => ['admin', 'menus', 'detail', code] as const,
  },

  settings: {
    all: ['admin', 'settings'] as const,
    map: () => ['admin', 'settings', 'map'] as const,
  },

  users: resource<UserListParams>('users'),

  authors: {
    all: ['admin', 'authors'] as const,
    list: () => ['admin', 'authors', 'list'] as const,
  },

  roles: {
    all: ['admin', 'roles'] as const,
    list: () => ['admin', 'roles', 'list'] as const,
    detail: (id: number) => ['admin', 'roles', 'detail', id] as const,
  },

  permissions: {
    all: ['admin', 'permissions'] as const,
    list: () => ['admin', 'permissions', 'list'] as const,
  },

  audit: {
    all: ['admin', 'audit'] as const,
    lists: () => ['admin', 'audit', 'list'] as const,
    list: (params?: AuditListParams) =>
      ['admin', 'audit', 'list', cleanParams(params)] as const,
  },
} as const;
