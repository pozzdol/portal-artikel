'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  createDataTableColumnHelper,
  DataTable,
} from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { useDeleteRole, useRoles } from '@/lib/api/admin/roles';
import type { Role } from '@/lib/api/admin/types';
import { toastApiError } from '@/lib/forms/serverErrors';

import { RoleFormDialog } from './RoleFormDialog';

const helper = createDataTableColumnHelper<Role>();

/** Role list + create/edit dialog (with the permission matrix) + delete (docs 07 §3.12). */
export function RolesView() {
  const { data: roles, isLoading } = useRoles();
  const deleteRole = useDeleteRole();

  const [formDialog, setFormDialog] = useState<{
    open: boolean;
    role: Role | null;
  }>({
    open: false,
    role: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    role: Role | null;
  }>({
    open: false,
    role: null,
  });

  async function confirmDelete() {
    const role = deleteDialog.role;
    if (!role) return;
    try {
      await deleteRole.mutateAsync(role.id);
      setDeleteDialog({ open: false, role: null });
    } catch (err) {
      toastApiError(err);
    }
  }

  const columns = [
    helper.accessor('name', {
      header: 'Nama',
      cell: (ctx) => {
        const role = ctx.row.original;
        return (
          <div className="flex flex-col">
            <span className="flex items-center gap-2 font-medium">
              {role.name}
              {role.is_system ? (
                <Badge variant="outline" className="font-normal">
                  Sistem
                </Badge>
              ) : null}
            </span>
            <span className="text-muted-foreground text-xs">{role.code}</span>
          </div>
        );
      },
    }),
    helper.accessor('description', {
      header: 'Deskripsi',
      cell: (ctx) =>
        ctx.getValue() ?? <span className="text-muted-foreground">—</span>,
      meta: { hideBelow: 'md' },
    }),
    helper.accessor('permissions', {
      header: 'Izin',
      cell: (ctx) => `${ctx.getValue().length} izin`,
      meta: { align: 'center', hideBelow: 'sm' },
    }),
    helper.accessor('user_count', {
      header: 'Pengguna',
      cell: (ctx) => ctx.getValue(),
      meta: { align: 'center' },
    }),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Role & izin"
        description="Kelola role dan hak akses. Membuat role baru tidak memerlukan perubahan kode."
        actions={
          <Button
            variant="gold"
            onClick={() => setFormDialog({ open: true, role: null })}
          >
            <PlusIcon data-icon="inline-start" />
            Buat role
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={roles ?? []}
        isLoading={isLoading}
        page={1}
        onPageChange={() => {}}
        getRowId={(r) => r.id}
        rowActions={(role) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFormDialog({ open: true, role })}
            >
              Sunting
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={role.is_system || role.user_count > 0}
              title={
                role.is_system
                  ? 'Role sistem tidak dapat dihapus.'
                  : role.user_count > 0
                    ? 'Role masih dipakai oleh pengguna.'
                    : undefined
              }
              onClick={() => setDeleteDialog({ open: true, role })}
            >
              Hapus
            </Button>
          </div>
        )}
      />

      <RoleFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog((s) => ({ ...s, open }))}
        role={formDialog.role}
      />
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((s) => ({ ...s, open }))}
        title={`Hapus role ${deleteDialog.role?.name}?`}
        description="Tindakan ini tidak dapat dibatalkan."
        confirmLabel={`Hapus ${deleteDialog.role?.name ?? ''}`}
        destructive
        onConfirm={confirmDelete}
        loading={deleteRole.isPending}
      />
    </div>
  );
}
