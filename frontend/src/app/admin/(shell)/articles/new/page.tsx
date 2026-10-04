import type { Metadata } from 'next';

import { ArticleEditor } from '@/components/admin/articles/ArticleEditor';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tulis artikel' };

export default function AdminNewArticlePage() {
  return (
    <PermissionGate perms={['articles.read']}>
      <PermissionGate perms={['articles.create']}>
        <ArticleEditor id={null} />
      </PermissionGate>
    </PermissionGate>
  );
}
