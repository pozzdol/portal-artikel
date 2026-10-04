import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AlumniEditView } from '@/components/admin/community/alumni/AlumniForm';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Sunting tokoh alumni' };

export default async function EditAlumniPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) notFound();

  return (
    <PermissionGate perms={['alumni.manage']}>
      <AlumniEditView id={numId} />
    </PermissionGate>
  );
}
