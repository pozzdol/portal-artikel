import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EventEditView } from '@/components/admin/community/events/EventForm';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Sunting agenda' };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) notFound();

  return (
    <PermissionGate perms={['events.manage']}>
      <EventEditView id={numId} />
    </PermissionGate>
  );
}
