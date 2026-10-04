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
  AdminVideo,
  ParseVideoUrlResult,
  PublishStatus,
  StatusListParams,
  VideoInput,
} from './types';

export type VideoListParams = StatusListParams<PublishStatus>;

export const videosApi = {
  list: (params?: VideoListParams, signal?: AbortSignal) =>
    getPaged<AdminVideo>('/admin/videos', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminVideo>(`/admin/videos/${id}`, undefined, signal),
  create: (input: VideoInput) => postData<AdminVideo>('/admin/videos', input),
  update: (id: number, input: VideoInput) =>
    putData<AdminVideo>(`/admin/videos/${id}`, input),
  remove: (id: number) => deleteData(`/admin/videos/${id}`),
  /** Any YouTube URL form (watch, youtu.be, shorts, embed) → id + thumbnail. */
  parseUrl: (url: string) =>
    postData<ParseVideoUrlResult>('/admin/videos/parse-url', { url }),
};

function invalidateVideos(qc: QueryClient) {
  return invalidate(qc, qk.videos.all, qk.dashboard.all);
}

export function useVideos(params?: VideoListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.videos.list(params),
    queryFn: ({ signal }) => videosApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useVideo(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.videos.detail(id ?? 0),
    queryFn: ({ signal }) => videosApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useCreateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VideoInput) => videosApi.create(input),
    onSuccess: (item) => {
      qc.setQueryData(qk.videos.detail(item.id), item);
      return invalidateVideos(qc);
    },
  });
}

export function useUpdateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: VideoInput }) =>
      videosApi.update(vars.id, vars.input),
    onSuccess: (item) => {
      qc.setQueryData(qk.videos.detail(item.id), item);
      return invalidateVideos(qc);
    },
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => videosApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.videos.detail(id) });
      return invalidateVideos(qc);
    },
  });
}

export function useParseVideoUrl() {
  return useMutation({ mutationFn: (url: string) => videosApi.parseUrl(url) });
}
