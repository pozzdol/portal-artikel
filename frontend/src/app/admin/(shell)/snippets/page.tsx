import type { Metadata } from 'next';

import { SnippetsView } from '@/components/admin/snippets/SnippetsView';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Snippet' };

export default function AdminSnippetsPage() {
  return (
    <PermissionGate perms={['snippets.manage']}>
      <SnippetsView />
    </PermissionGate>
  );
}
