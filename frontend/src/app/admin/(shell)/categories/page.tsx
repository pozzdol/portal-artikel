import type { Metadata } from 'next';

import { CategoriesPage } from '@/components/admin/taxonomy/CategoriesPage';
import { PermissionGate } from '@/components/admin/shell/PermissionGate';

export const metadata: Metadata = { title: 'Kategori' };

export default function AdminCategoriesPage() {
  return (
    <PermissionGate perms={['categories.manage']}>
      <CategoriesPage />
    </PermissionGate>
  );
}
