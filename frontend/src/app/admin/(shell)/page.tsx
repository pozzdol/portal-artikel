import type { Metadata } from 'next';

import { DashboardView } from '@/components/admin/dashboard/DashboardView';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Dasbor' };

export default function AdminDashboardPage() {
  return (
    <PermissionGate perms={['dashboard.view']}>
      <DashboardView />
    </PermissionGate>
  );
}
