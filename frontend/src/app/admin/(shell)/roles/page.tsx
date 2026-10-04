import type { Metadata } from 'next';

import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { RolesView } from '@/components/admin/roles/RolesView';

export const metadata: Metadata = { title: 'Role & izin' };

export default function AdminRolesPage() {
  return (
    <PermissionGate perms={['roles.manage']}>
      <RolesView />
    </PermissionGate>
  );
}
