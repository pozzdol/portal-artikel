import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PagesList } from '@/components/admin/community/pages/PagesList';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Halaman statis' };

export default function AdminPagesPage() {
  return (
    <PermissionGate perms={['pages.manage']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <PagesList />
      </Suspense>
    </PermissionGate>
  );
}
