import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { VideoEditView } from '@/components/admin/community/videos/VideoForm';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Sunting video' };

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) notFound();

  return (
    <PermissionGate perms={['videos.manage']}>
      <VideoEditView id={numId} />
    </PermissionGate>
  );
}
