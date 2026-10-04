import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AlumniList } from '@/components/admin/community/alumni/AlumniList';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tokoh Alumni' };

export default function AdminAlumniPage() {
  return (
    <PermissionGate perms={['alumni.manage']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <AlumniList />
      </Suspense>
    </PermissionGate>
  );
}
