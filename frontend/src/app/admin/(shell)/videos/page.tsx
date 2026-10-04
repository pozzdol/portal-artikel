import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VideosList } from '@/components/admin/community/videos/VideosList';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Video' };

export default function AdminVideosPage() {
  return (
    <PermissionGate perms={['videos.manage']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <VideosList />
      </Suspense>
    </PermissionGate>
  );
}
