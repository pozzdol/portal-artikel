import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { qk } from './keys';
import {
  deleteData,
  getData,
  getPaged,
  invalidate,
  keepPrevious,
  postData,
  putData,
  toQuery,
  type QueryOpts,
} from './shared';
import type {
  AdminArticleDetail,
  AdminArticleItem,
  ArticleInput,
  ArticleListParams,
  PreviewToken,
  PublishArticleInput,
  SlugCheck,
} from './types';

export const articlesApi = {
  list: (params?: ArticleListParams, signal?: AbortSignal) =>
    getPaged<AdminArticleItem>('/admin/articles', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminArticleDetail>(`/admin/articles/${id}`, undefined, signal),
  create: (input: ArticleInput) =>
    postData<AdminArticleDetail>('/admin/articles', input),
  update: (id: number, input: ArticleInput) =>
    putData<AdminArticleDetail>(`/admin/articles/${id}`, input),
  remove: (id: number) => deleteData(`/admin/articles/${id}`),
  publish: (id: number, input?: PublishArticleInput) =>
    postData<AdminArticleDetail>(
      `/admin/articles/${id}/publish`,
      input && input.published_at
        ? { published_at: input.published_at }
        : undefined,
    ),
  unpublish: (id: number) =>
    postData<AdminArticleDetail>(`/admin/articles/${id}/unpublish`),
  restore: (id: number) => postData<void>(`/admin/articles/${id}/restore`),
  previewToken: (id: number) =>
    getData<PreviewToken>(`/admin/articles/${id}/preview-token`),
  /** For SlugField.checkAvailability. */
  slugCheck: (slug: string, excludeId?: number, signal?: AbortSignal) =>
    getData<SlugCheck>(
      '/admin/articles/slug-check',
      { slug, exclude_id: excludeId || undefined },
      signal,
    ),
};

/** Article writes can change tags (new_tags), taxonomy counts and the dashboard. */
function invalidateArticleFamily(qc: QueryClient) {
  return invalidate(
    qc,
    qk.articles.all,
    qk.dashboard.all,
    qk.tags.all,
    qk.categories.all,
  );
}

function storeDetail(qc: QueryClient, d: AdminArticleDetail) {
  qc.setQueryData(qk.articles.detail(d.id), d);
}

export function useArticles(params?: ArticleListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.articles.list(params),
    queryFn: ({ signal }) => articlesApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useArticle(
  id: number | null | undefined,
  opts: QueryOpts = {},
) {
  return useQuery({
    queryKey: qk.articles.detail(id ?? 0),
    queryFn: ({ signal }) => articlesApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useArticleSlugCheck(
  slug: string | null | undefined,
  excludeId?: number,
  opts: QueryOpts = {},
) {
  const s = (slug ?? '').trim();
  return useQuery({
    queryKey: qk.articles.slugCheck(s, excludeId),
    queryFn: ({ signal }) => articlesApi.slugCheck(s, excludeId, signal),
    staleTime: 10_000,
    ...opts,
    enabled: s.length > 0 && (opts.enabled ?? true),
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: articlesApi.create,
    onSuccess: (d) => {
      storeDetail(qc, d);
      return invalidateArticleFamily(qc);
    },
  });
}

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: ArticleInput }) =>
      articlesApi.update(vars.id, vars.input),
    onSuccess: (d) => {
      storeDetail(qc, d);
      return invalidateArticleFamily(qc);
    },
  });
}

/** Soft delete (moves to trash). */
export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => articlesApi.remove(id),
    onSuccess: () => invalidateArticleFamily(qc),
  });
}

export function useRestoreArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => articlesApi.restore(id),
    onSuccess: () => invalidateArticleFamily(qc),
  });
}

/** `published_at` omitted/past = publish now; future = schedule. */
export function usePublishArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; published_at?: string | null }) =>
      articlesApi.publish(vars.id, { published_at: vars.published_at }),
    onSuccess: (d) => {
      storeDetail(qc, d);
      return invalidateArticleFamily(qc);
    },
  });
}

export function useUnpublishArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => articlesApi.unpublish(id),
    onSuccess: (d) => {
      storeDetail(qc, d);
      return invalidateArticleFamily(qc);
    },
  });
}

/** Issues a fresh 30-minute preview token (not cached). */
export function usePreviewToken() {
  return useMutation({
    mutationFn: (id: number) => articlesApi.previewToken(id),
  });
}
