import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageEditView } from '@/components/admin/community/pages/PageForm';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Sunting halaman' };

export default async function EditStaticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) notFound();

  return (
    <PermissionGate perms={['pages.manage']}>
      <PageEditView id={numId} />
    </PermissionGate>
  );
}
