import type { Metadata } from 'next';

import { PermissionGate } from '@/components/admin/shell/PermissionGate';
import { SettingsView } from '@/components/admin/settings/SettingsView';

export const metadata: Metadata = { title: 'Pengaturan situs' };

export default function AdminSettingsPage() {
  return (
    <PermissionGate perms={['settings.manage']}>
      <SettingsView />
    </PermissionGate>
  );
}
