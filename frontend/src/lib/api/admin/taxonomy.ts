import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { adminApi } from '@/lib/api/client';

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
  CategoryInput,
  CategoryReorderItem,
  CategoryTreeNode,
  Paged,
  Tag,
  TagInput,
  TagListParams,
} from './types';

export const categoriesApi = {
  tree: (signal?: AbortSignal) =>
    getData<CategoryTreeNode[]>('/admin/categories', undefined, signal),
  /** Active categories only; no permission needed (fallback for roles without categories.manage). */
  publicTree: async (signal?: AbortSignal) =>
    (
      await adminApi.get<CategoryTreeNode[]>('/public/categories', undefined, {
        signal,
        silentUnauthenticated: true,
      })
    ).data,
  create: (input: CategoryInput) =>
    postData<CategoryTreeNode>('/admin/categories', input),
  update: (id: number, input: CategoryInput) =>
    putData<CategoryTreeNode>(`/admin/categories/${id}`, input),
  remove: (id: number) => deleteData(`/admin/categories/${id}`),
  /** Must contain the exact set of categories; returns the new tree. */
  reorder: (items: CategoryReorderItem[]) =>
    putData<CategoryTreeNode[]>('/admin/categories/reorder', { items }),
};

export const tagsApi = {
  list: (params?: TagListParams, signal?: AbortSignal) =>
    getPaged<Tag>('/admin/tags', toQuery(params), signal),
  /** Public tag search (no tags.manage needed). */
  publicList: async (q?: string, signal?: AbortSignal): Promise<Paged<Tag>> => {
    const res = await adminApi.get<Tag[]>(
      '/public/tags',
      { q, per_page: 20 },
      { signal, silentUnauthenticated: true },
    );
    return {
      items: res.data ?? [],
      meta: res.meta ?? { page: 1, per_page: 20, total: 0, total_pages: 0 },
    };
  },
  create: (input: TagInput) => postData<Tag>('/admin/tags', input),
  update: (id: number, input: TagInput) =>
    putData<Tag>(`/admin/tags/${id}`, input),
  remove: (id: number) => deleteData(`/admin/tags/${id}`),
  /** Moves articles from `id` into `into_id`, deletes `id`; returns the target tag. */
  merge: (id: number, intoId: number) =>
    postData<Tag>(`/admin/tags/${id}/merge`, { into_id: intoId }),
};

// Category/tag names and counts appear inside article cards.
function invalidateCategories(qc: QueryClient) {
  return invalidate(qc, qk.categories.all, qk.articles.all);
}
function invalidateTags(qc: QueryClient) {
  return invalidate(qc, qk.tags.all, qk.articles.all);
}

// ----- categories -----------------------------------------------------------

export function useCategoryTree(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.categories.tree(),
    queryFn: ({ signal }) => categoriesApi.tree(signal),
    ...opts,
  });
}

export function usePublicCategoryTree(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.categories.publicTree(),
    queryFn: ({ signal }) => categoriesApi.publicTree(signal),
    staleTime: 5 * 60_000,
    ...opts,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: CategoryInput }) =>
      categoriesApi.update(vars.id, vars.input),
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => invalidateCategories(qc),
  });
}

/** Writes the returned tree into the cache immediately. */
export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: CategoryReorderItem[]) => categoriesApi.reorder(items),
    onSuccess: (tree) => {
      qc.setQueryData(qk.categories.tree(), tree);
      return invalidateCategories(qc);
    },
  });
}

// ----- tags -----------------------------------------------------------------

export function useTags(params?: TagListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.tags.list(params),
    queryFn: ({ signal }) => tagsApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function usePublicTags(q?: string, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.tags.publicList(q),
    queryFn: ({ signal }) => tagsApi.publicList(q, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => invalidateTags(qc),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: TagInput }) =>
      tagsApi.update(vars.id, vars.input),
    onSuccess: () => invalidateTags(qc),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tagsApi.remove(id),
    onSuccess: () => invalidateTags(qc),
  });
}

export function useMergeTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; intoId: number }) =>
      tagsApi.merge(vars.id, vars.intoId),
    onSuccess: () => invalidateTags(qc),
  });
}
