import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { TagsPage } from '@/components/admin/taxonomy/TagsPage';

export const metadata: Metadata = { title: 'Tag' };

export default function AdminTagsPage() {
  return (
    <PermissionGate perms={['tags.manage']}>
      <Suspense fallback={<ListPageSkeleton rows={8} columns={3} />}>
        <TagsPage />
      </Suspense>
    </PermissionGate>
  );
}
