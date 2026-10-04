import type { Metadata } from 'next';
import { Suspense } from 'react';

import { EventsList } from '@/components/admin/community/events/EventsList';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Agenda' };

export default function AdminEventsPage() {
  return (
    <PermissionGate perms={['events.manage']}>
      <Suspense fallback={<ListPageSkeleton />}>
        <EventsList />
      </Suspense>
    </PermissionGate>
  );
}
