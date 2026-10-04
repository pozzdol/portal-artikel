import type { Metadata } from 'next';

import { AlumniForm } from '@/components/admin/community/alumni/AlumniForm';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tambah tokoh alumni' };

export default function NewAlumniPage() {
  return (
    <PermissionGate perms={['alumni.manage']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tambah tokoh alumni"
          description="Profil baru akan tampil di /tokoh setelah berstatus terbit."
        />
        <AlumniForm />
      </div>
    </PermissionGate>
  );
}
