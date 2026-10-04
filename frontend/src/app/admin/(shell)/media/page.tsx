import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { MediaLibraryPage } from '@/components/admin/media/MediaLibraryPage';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Pustaka media' };

export default function AdminMediaPage() {
  return (
    <PermissionGate perms={['media.manage']}>
      <Suspense fallback={<ListPageSkeleton rows={4} columns={5} />}>
        <MediaLibraryPage />
      </Suspense>
    </PermissionGate>
  );
}
