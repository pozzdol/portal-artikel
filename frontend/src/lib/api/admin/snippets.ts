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
import type {
  AdminSnippet,
  SnippetInput,
  SnippetType,
  SortOrderItem,
} from './types';

export const snippetsApi = {
  /** Plain array; `type` omitted = all types. */
  list: (type?: SnippetType, signal?: AbortSignal) =>
    getData<AdminSnippet[]>('/admin/snippets', { type }, signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminSnippet>(`/admin/snippets/${id}`, undefined, signal),
  create: (input: SnippetInput) =>
    postData<AdminSnippet>('/admin/snippets', input),
  update: (id: number, input: SnippetInput) =>
    putData<AdminSnippet>(`/admin/snippets/${id}`, input),
  remove: (id: number) => deleteData(`/admin/snippets/${id}`),
  /** 204; items of one type [{id, sort_order}]. */
  reorder: (items: SortOrderItem[]) =>
    putData<void>('/admin/snippets/reorder', { items }),
};

function invalidateSnippets(qc: QueryClient) {
  return invalidate(qc, qk.snippets.all);
}

export function useSnippets(type?: SnippetType, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.snippets.list(type),
    queryFn: ({ signal }) => snippetsApi.list(type, signal),
    ...opts,
  });
}

export function useSnippet(
  id: number | null | undefined,
  opts: QueryOpts = {},
) {
  return useQuery({
    queryKey: qk.snippets.detail(id ?? 0),
    queryFn: ({ signal }) => snippetsApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useCreateSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SnippetInput) => snippetsApi.create(input),
    onSuccess: () => invalidateSnippets(qc),
  });
}

export function useUpdateSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: SnippetInput }) =>
      snippetsApi.update(vars.id, vars.input),
    onSuccess: () => invalidateSnippets(qc),
  });
}

export function useDeleteSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => snippetsApi.remove(id),
    onSuccess: () => invalidateSnippets(qc),
  });
}

/**
 * Optimistic reorder of the list for `type`: pass the items in their new
 * order; sort_order is assigned as (i+1)*10. Rolls back on error.
 */
export function useReorderSnippets(type: SnippetType) {
  const qc = useQueryClient();
  const key = qk.snippets.list(type);
  return useMutation({
    mutationFn: (ordered: AdminSnippet[]) =>
      snippetsApi.reorder(
        ordered.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 })),
      ),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AdminSnippet[]>(key);
      qc.setQueryData<AdminSnippet[]>(
        key,
        ordered.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => invalidateSnippets(qc),
  });
}
