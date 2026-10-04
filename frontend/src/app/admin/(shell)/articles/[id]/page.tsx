import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticleEditor } from '@/components/admin/articles/ArticleEditor';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Edit artikel' };

export default async function AdminEditArticlePage(
  props: PageProps<'/admin/articles/[id]'>,
) {
  const { id: raw } = await props.params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return (
    <PermissionGate perms={['articles.read']}>
      <ArticleEditor id={id} />
    </PermissionGate>
  );
}
