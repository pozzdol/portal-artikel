import { useQuery } from '@tanstack/react-query';

import { qk } from './keys';
import { getPaged, keepPrevious, toQuery, type QueryOpts } from './shared';
import type { AuditListParams, AuditLog } from './types';

export const auditApi = {
  list: (params?: AuditListParams, signal?: AbortSignal) =>
    getPaged<AuditLog>('/admin/audit-logs', toQuery(params), signal),
};

export function useAuditLogs(params?: AuditListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.audit.list(params),
    queryFn: ({ signal }) => auditApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}
