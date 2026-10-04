import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { ArticleList } from '@/components/admin/articles/ArticleList';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Artikel' };

export default function AdminArticlesPage() {
  return (
    <PermissionGate perms={['articles.read']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <ArticleList />
      </Suspense>
    </PermissionGate>
  );
}
