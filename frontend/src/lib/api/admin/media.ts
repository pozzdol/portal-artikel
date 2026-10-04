import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { upload } from '@/lib/api/client';

import { qk } from './keys';
import {
  deleteData,
  getData,
  getPaged,
  invalidate,
  keepPrevious,
  putData,
  toQuery,
  type QueryOpts,
} from './shared';
import type {
  MediaItem,
  MediaListParams,
  MediaUpdateInput,
  MediaUploadInput,
} from './types';

/** Backend cap for GET /admin/media?ids= (larger sets are chunked). */
export const MEDIA_IDS_MAX = 100;

/** Sorted, de-duplicated, positive ids. */
export function normalizeMediaIds(
  ids: readonly (number | null | undefined)[],
): number[] {
  const set = new Set<number>();
  for (const id of ids) if (typeof id === 'number' && id > 0) set.add(id);
  return [...set].sort((a, b) => a - b);
}

export const mediaApi = {
  list: (params?: MediaListParams, signal?: AbortSignal) =>
    getPaged<MediaItem>('/admin/media', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<MediaItem>(`/admin/media/${id}`, undefined, signal),
  /** Unknown ids are skipped by the backend; chunks of 100. */
  byIds: async (
    ids: readonly number[],
    signal?: AbortSignal,
  ): Promise<MediaItem[]> => {
    if (ids.length === 0) return [];
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += MEDIA_IDS_MAX) {
      chunks.push(ids.slice(i, i + MEDIA_IDS_MAX));
    }
    const parts = await Promise.all(
      chunks.map((c) =>
        getData<MediaItem[]>('/admin/media', { ids: c }, signal),
      ),
    );
    return parts.flat();
  },
  upload: async (input: MediaUploadInput): Promise<MediaItem> => {
    const fd = new FormData();
    if (input.filename) fd.append('file', input.file, input.filename);
    else fd.append('file', input.file);
    if (input.alt_text) fd.append('alt_text', input.alt_text);
    if (input.caption) fd.append('caption', input.caption);
    const res = await upload<MediaItem>('/admin/media', fd, {
      onProgress: input.onProgress,
      signal: input.signal,
    });
    return res.data;
  },
  update: (id: number, input: MediaUpdateInput) =>
    putData<MediaItem>(`/admin/media/${id}`, input),
  /** 409 when still referenced by content. */
  remove: (id: number) => deleteData(`/admin/media/${id}`),
};

function invalidateMedia(qc: QueryClient) {
  // Articles embed cover/og media objects.
  return invalidate(qc, qk.media.all, qk.articles.all);
}

export function useMediaList(params?: MediaListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.media.list(params),
    queryFn: ({ signal }) => mediaApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useMediaItem(
  id: number | null | undefined,
  opts: QueryOpts = {},
) {
  return useQuery({
    queryKey: qk.media.detail(id ?? 0),
    queryFn: ({ signal }) => mediaApi.get(id as number, signal),
    staleTime: 5 * 60_000,
    ...opts,
    enabled: !!id && id > 0 && (opts.enabled ?? true),
  });
}

/**
 * Resolves media ids to items (for previews). `data` is in ascending id
 * order; `byId` gives O(1) lookup. Missing ids are simply absent.
 */
export function useMediaByIds(
  ids: readonly (number | null | undefined)[],
  opts: QueryOpts = {},
) {
  const norm = normalizeMediaIds(ids);
  const query = useQuery({
    queryKey: qk.media.byIds(norm),
    queryFn: ({ signal }) => mediaApi.byIds(norm, signal),
    staleTime: 5 * 60_000,
    ...opts,
    enabled: norm.length > 0 && (opts.enabled ?? true),
  });
  const data = query.data;
  const byId = useMemo(() => {
    const m = new Map<number, MediaItem>();
    for (const it of data ?? []) m.set(it.id, it);
    return m;
  }, [data]);
  return { ...query, byId };
}

/** Upload one file; variables carry `onProgress` / `signal`. */
export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MediaUploadInput) => mediaApi.upload(input),
    onSuccess: (item) => {
      qc.setQueryData(qk.media.detail(item.id), item);
      return invalidate(qc, qk.media.lists());
    },
  });
}

export function useUpdateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: MediaUpdateInput }) =>
      mediaApi.update(vars.id, vars.input),
    onSuccess: (item) => {
      qc.setQueryData(qk.media.detail(item.id), item);
      return invalidateMedia(qc);
    },
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => mediaApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.media.detail(id) });
      return invalidateMedia(qc);
    },
  });
}
