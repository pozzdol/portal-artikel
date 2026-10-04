import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from './keys';
import { getData, invalidate, putData, type QueryOpts } from './shared';
import type { AdminMenu, MenuItemInput } from './types';

export const menusApi = {
  list: (signal?: AbortSignal) =>
    getData<AdminMenu[]>('/admin/menus', undefined, signal),
  get: (code: string, signal?: AbortSignal) =>
    getData<AdminMenu>(
      `/admin/menus/${encodeURIComponent(code)}`,
      undefined,
      signal,
    ),
  /** Replaces the whole tree (max depth 2); returns the saved menu. */
  replaceItems: (code: string, items: MenuItemInput[]) =>
    putData<AdminMenu>(`/admin/menus/${encodeURIComponent(code)}/items`, {
      items,
    }),
};

export function useMenus(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.menus.list(),
    queryFn: ({ signal }) => menusApi.list(signal),
    ...opts,
  });
}

export function useMenu(code: string | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.menus.detail(code ?? ''),
    queryFn: ({ signal }) => menusApi.get(code as string, signal),
    ...opts,
    enabled: !!code && (opts.enabled ?? true),
  });
}

export function useReplaceMenuItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { code: string; items: MenuItemInput[] }) =>
      menusApi.replaceItems(vars.code, vars.items),
    onSuccess: (menu) => {
      qc.setQueryData(qk.menus.detail(menu.code), menu);
      qc.setQueryData<AdminMenu[]>(qk.menus.list(), (old) =>
        old?.map((m) => (m.code === menu.code ? menu : m)),
      );
      return invalidate(qc, qk.menus.all);
    },
  });
}
