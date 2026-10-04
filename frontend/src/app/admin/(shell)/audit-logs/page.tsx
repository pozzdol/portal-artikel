import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { AuditLogsView } from '@/components/admin/audit/AuditLogsView';

export const metadata: Metadata = { title: 'Log aktivitas' };

export default function AdminAuditLogsPage() {
  return (
    <PermissionGate perms={['audit.view']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <AuditLogsView />
      </Suspense>
    </PermissionGate>
  );
}
