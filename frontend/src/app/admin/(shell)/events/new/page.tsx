import type { Metadata } from 'next';

import { EventForm } from '@/components/admin/community/events/EventForm';
import { PageHeader } from '@/components/admin/PageHeader';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Tambah agenda' };

export default function NewEventPage() {
  return (
    <PermissionGate perms={['events.manage']}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tambah agenda"
          description="Acara baru akan tampil di /agenda setelah berstatus terbit."
        />
        <EventForm />
      </div>
    </PermissionGate>
  );
}
