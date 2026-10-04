import { useQuery } from '@tanstack/react-query';

import { qk } from './keys';
import { getData, type QueryOpts } from './shared';
import type { DashboardPayload } from './types';

export const dashboardApi = {
  get: (signal?: AbortSignal) =>
    getData<DashboardPayload>('/admin/dashboard', undefined, signal),
};

export function useDashboard(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.dashboard.get(),
    queryFn: ({ signal }) => dashboardApi.get(signal),
    ...opts,
  });
}
