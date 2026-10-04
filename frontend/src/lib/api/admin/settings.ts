import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/lib/api/client';

import { qk } from './keys';
import { getData, invalidate, type QueryOpts } from './shared';
import type {
  AdminSettings,
  AdminSettingsMap,
  SettingItem,
  SettingKey,
} from './types';

export const settingsApi = {
  /** Raw map {key: value}. */
  list: (signal?: AbortSignal) =>
    getData<AdminSettingsMap>('/admin/settings', undefined, signal),
  /** Body is the value itself (not wrapped); unknown fields → 422, unknown key → 404. */
  update: async <K extends SettingKey>(key: K, value: AdminSettings[K]) =>
    (
      await adminApi.put<SettingItem<K>>(
        `/admin/settings/${encodeURIComponent(key)}`,
        value,
      )
    ).data,
};

export function useSettings(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.settings.map(),
    queryFn: ({ signal }) => settingsApi.list(signal),
    ...opts,
  });
}

/** Convenience selector for one key. */
export function useSetting<K extends SettingKey>(key: K, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.settings.map(),
    queryFn: ({ signal }) => settingsApi.list(signal),
    select: (map) => map[key] as AdminSettings[K] | undefined,
    ...opts,
  });
}

/** Discriminated union so `value` is typed by `key`. */
export type UpdateSettingVars = {
  [K in SettingKey]: { key: K; value: AdminSettings[K] };
}[SettingKey];

/**
 * `K` pins both the accepted `{key, value}` and the resolved `SettingItem`'s `value` to
 * one setting, so a settings tab can write `useUpdateSetting<'site.identity'>()` and read
 * `mutateAsync(...).value` back as `AdminSettings['site.identity']` with no cast. Left
 * unspecified, it keeps the old widened (any-key) behavior.
 */
export function useUpdateSetting<K extends SettingKey = SettingKey>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: K; value: AdminSettings[K] }) =>
      settingsApi.update(vars.key, vars.value),
    onSuccess: (item: SettingItem<K>) => {
      qc.setQueryData<AdminSettingsMap>(qk.settings.map(), (old) => ({
        ...old,
        [item.key]: item.value,
      }));
      return invalidate(qc, qk.settings.all);
    },
  });
}
