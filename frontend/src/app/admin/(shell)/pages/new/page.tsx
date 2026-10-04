import type { Metadata } from 'next';

import { PageForm } from '@/components/admin/community/pages/PageForm';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tambah halaman' };

export default function NewStaticPage() {
  return (
    <PermissionGate perms={['pages.manage']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tambah halaman"
          description="Halaman baru akan tampil di /halaman/{slug} setelah berstatus terbit."
        />
        <PageForm />
      </div>
    </PermissionGate>
  );
}
