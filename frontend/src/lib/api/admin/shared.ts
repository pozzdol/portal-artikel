// Small helpers shared by the admin hook modules.

import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { adminApi, type QueryParams } from '@/lib/api/client';

import type { ListMeta, Paged } from './types';

/** Options accepted by every query hook. */
export type QueryOpts = {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
};

const EMPTY_META: ListMeta = { page: 1, per_page: 0, total: 0, total_pages: 0 };

export async function getData<T>(
  path: string,
  query?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  const res = await adminApi.get<T>(path, query, { signal });
  return res.data;
}

export async function getPaged<T>(
  path: string,
  query?: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<T>> {
  const res = await adminApi.get<T[]>(path, query, { signal });
  return { items: res.data ?? [], meta: res.meta ?? EMPTY_META };
}

export async function postData<T>(path: string, body?: unknown): Promise<T> {
  return (await adminApi.post<T>(path, body)).data;
}

export async function putData<T>(path: string, body?: unknown): Promise<T> {
  return (await adminApi.put<T>(path, body)).data;
}

export async function deleteData(path: string): Promise<void> {
  await adminApi.del(path);
}

export function invalidate(
  qc: QueryClient,
  ...keys: QueryKey[]
): Promise<void> {
  return Promise.all(
    keys.map((queryKey) => qc.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}

/** Keep the previous page visible while the next one loads. */
export const keepPrevious = { placeholderData: keepPreviousData } as const;

export function toQuery<T extends object>(params?: T): QueryParams {
  return (params ?? {}) as QueryParams;
}
