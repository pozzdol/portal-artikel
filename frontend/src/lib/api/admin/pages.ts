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
  invalidate,
  postData,
  putData,
  type QueryOpts,
} from './shared';
import type { AdminPage, PageInput } from './types';

export const pagesApi = {
  /** Plain array (no paging, full items incl. content). */
  list: (signal?: AbortSignal) =>
    getData<AdminPage[]>('/admin/pages', undefined, signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminPage>(`/admin/pages/${id}`, undefined, signal),
  create: (input: PageInput) => postData<AdminPage>('/admin/pages', input),
  update: (id: number, input: PageInput) =>
    putData<AdminPage>(`/admin/pages/${id}`, input),
  remove: (id: number) => deleteData(`/admin/pages/${id}`),
};

// Menus of link_type "page" reference page slugs.
function invalidatePages(qc: QueryClient) {
  return invalidate(qc, qk.pages.all, qk.menus.all);
}

export function usePages(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.pages.list(),
    queryFn: ({ signal }) => pagesApi.list(signal),
    ...opts,
  });
}

export function usePage(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.pages.detail(id ?? 0),
    queryFn: ({ signal }) => pagesApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PageInput) => pagesApi.create(input),
    onSuccess: (item) => {
      qc.setQueryData(qk.pages.detail(item.id), item);
      return invalidatePages(qc);
    },
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: PageInput }) =>
      pagesApi.update(vars.id, vars.input),
    onSuccess: (item) => {
      qc.setQueryData(qk.pages.detail(item.id), item);
      return invalidatePages(qc);
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pagesApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.pages.detail(id) });
      return invalidatePages(qc);
    },
  });
}
