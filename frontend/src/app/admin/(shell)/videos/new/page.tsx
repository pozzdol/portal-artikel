import type { Metadata } from 'next';

import { VideoForm } from '@/components/admin/community/videos/VideoForm';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tambah video' };

export default function NewVideoPage() {
  return (
    <PermissionGate perms={['videos.manage']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tambah video"
          description="Video baru akan tampil di /video setelah berstatus terbit."
        />
        <VideoForm />
      </div>
    </PermissionGate>
  );
}
