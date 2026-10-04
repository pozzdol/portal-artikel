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
  AdminEvent,
  EventInput,
  EventStatus,
  StatusListParams,
} from './types';

export type EventListParams = StatusListParams<EventStatus>;

export const eventsApi = {
  list: (params?: EventListParams, signal?: AbortSignal) =>
    getPaged<AdminEvent>('/admin/events', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<AdminEvent>(`/admin/events/${id}`, undefined, signal),
  create: (input: EventInput) => postData<AdminEvent>('/admin/events', input),
  update: (id: number, input: EventInput) =>
    putData<AdminEvent>(`/admin/events/${id}`, input),
  remove: (id: number) => deleteData(`/admin/events/${id}`),
};

function invalidateEvents(qc: QueryClient) {
  return invalidate(qc, qk.events.all, qk.dashboard.all);
}

export function useEvents(params?: EventListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.events.list(params),
    queryFn: ({ signal }) => eventsApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useEvent(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.events.detail(id ?? 0),
    queryFn: ({ signal }) => eventsApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => eventsApi.create(input),
    onSuccess: (item) => {
      qc.setQueryData(qk.events.detail(item.id), item);
      return invalidateEvents(qc);
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: EventInput }) =>
      eventsApi.update(vars.id, vars.input),
    onSuccess: (item) => {
      qc.setQueryData(qk.events.detail(item.id), item);
      return invalidateEvents(qc);
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => eventsApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.events.detail(id) });
      return invalidateEvents(qc);
    },
  });
}
