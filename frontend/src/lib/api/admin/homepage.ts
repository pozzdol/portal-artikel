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
  CreateSectionInput,
  HomepageSection,
  SectionTypeInfo,
  UpdateSectionInput,
} from './types';

export const homepageApi = {
  sectionTypes: (signal?: AbortSignal) =>
    getData<SectionTypeInfo[]>(
      '/admin/homepage/section-types',
      undefined,
      signal,
    ),
  /** All sections incl. inactive, ordered by position. */
  sections: (signal?: AbortSignal) =>
    getData<HomepageSection[]>('/admin/homepage/sections', undefined, signal),
  create: (input: CreateSectionInput) =>
    postData<HomepageSection>('/admin/homepage/sections', input),
  update: (id: number, input: UpdateSectionInput) =>
    putData<HomepageSection>(`/admin/homepage/sections/${id}`, input),
  remove: (id: number) => deleteData(`/admin/homepage/sections/${id}`),
  /** Exact set of all section ids in the new order; returns the reordered list. */
  reorder: (ids: number[]) =>
    putData<HomepageSection[]>('/admin/homepage/sections/reorder', { ids }),
};

function invalidateSections(qc: QueryClient) {
  return invalidate(qc, qk.homepage.sections());
}

/** Static per deploy: cached for the session. */
export function useSectionTypes(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.homepage.sectionTypes(),
    queryFn: ({ signal }) => homepageApi.sectionTypes(signal),
    staleTime: Infinity,
    ...opts,
  });
}

export function useHomepageSections(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.homepage.sections(),
    queryFn: ({ signal }) => homepageApi.sections(signal),
    ...opts,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSectionInput) => homepageApi.create(input),
    onSuccess: () => invalidateSections(qc),
  });
}

/** Patches the cached list with the returned section, then refetches. */
export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: UpdateSectionInput }) =>
      homepageApi.update(vars.id, vars.input),
    onSuccess: (section) => {
      qc.setQueryData<HomepageSection[]>(qk.homepage.sections(), (old) =>
        old?.map((s) => (s.id === section.id ? section : s)),
      );
      return invalidateSections(qc);
    },
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => homepageApi.remove(id),
    onSuccess: () => invalidateSections(qc),
  });
}

/** Optimistic: pass the full list of ids in the new order. Rolls back on error. */
export function useReorderSections() {
  const qc = useQueryClient();
  const key = qk.homepage.sections();
  return useMutation({
    mutationFn: (ids: number[]) => homepageApi.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<HomepageSection[]>(key);
      if (previous) {
        const byId = new Map(previous.map((s) => [s.id, s]));
        const next = ids
          .map((id) => byId.get(id))
          .filter((s): s is HomepageSection => !!s);
        qc.setQueryData(key, next);
      }
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (list) => {
      qc.setQueryData(key, list);
    },
    onSettled: () => invalidateSections(qc),
  });
}
