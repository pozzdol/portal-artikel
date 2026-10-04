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
  AdminAlumni,
  AlumniInput,
  PublishStatus,
  SortOrderItem,
  StatusListParams,
} from './types';

export type AlumniListParams = StatusListParams<PublishStatus>;

export const alumniApi = {
  list: (params?: AlumniListParams, signal?: AbortSignal) =>
    getPaged<AdminAlumni>('/admin/alumni', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminAlumni>(`/admin/alumni/${id}`, undefined, signal),
  create: (input: AlumniInput) => postData<AdminAlumni>('/admin/alumni', input),
  update: (id: number, input: AlumniInput) =>
    putData<AdminAlumni>(`/admin/alumni/${id}`, input),
  remove: (id: number) => deleteData(`/admin/alumni/${id}`),
  /** 204; items [{id, sort_order}]. */
  reorder: (items: SortOrderItem[]) =>
    putData<void>('/admin/alumni/reorder', { items }),
};

function invalidateAlumniList(qc: QueryClient) {
  return invalidate(qc, qk.alumni.all, qk.dashboard.all);
}

export function useAlumniList(params?: AlumniListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.alumni.list(params),
    queryFn: ({ signal }) => alumniApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useAlumni(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.alumni.detail(id ?? 0),
    queryFn: ({ signal }) => alumniApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useCreateAlumni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AlumniInput) => alumniApi.create(input),
    onSuccess: (item) => {
      qc.setQueryData(qk.alumni.detail(item.id), item);
      return invalidateAlumniList(qc);
    },
  });
}

export function useUpdateAlumni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: AlumniInput }) =>
      alumniApi.update(vars.id, vars.input),
    onSuccess: (item) => {
      qc.setQueryData(qk.alumni.detail(item.id), item);
      return invalidateAlumniList(qc);
    },
  });
}

export function useDeleteAlumni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alumniApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.alumni.detail(id) });
      return invalidateAlumniList(qc);
    },
  });
}

export function useReorderAlumni() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: SortOrderItem[]) => alumniApi.reorder(items),
    onSettled: () => invalidateAlumniList(qc),
  });
}
