import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { UsersView } from '@/components/admin/users/UsersView';

export const metadata: Metadata = { title: 'Pengguna & penulis' };

export default function AdminUsersPage() {
  return (
    <PermissionGate perms={['users.manage', 'authors.manage']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <UsersView />
      </Suspense>
    </PermissionGate>
  );
}
