import type { Metadata } from 'next';

import { MenusView } from '@/components/admin/menus/MenusView';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Menu' };

export default function AdminMenusPage() {
  return (
    <PermissionGate perms={['menus.manage']}>
      <MenusView />
    </PermissionGate>
  );
}
