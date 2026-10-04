'use client';

import { useEffect, useState } from 'react';
import {
  KeyRoundIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserRoundPlusIcon,
} from 'lucide-react';

import {
  createDataTableColumnHelper,
  DataTable,
} from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { PageHeader } from '@/components/admin/PageHeader';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/shadcn/toggle-group';
import { useQueryClient } from '@tanstack/react-query';

import { useMe } from '@/lib/api/admin/auth';
import { qk } from '@/lib/api/admin/keys';
import type { UserDetail, UserItem } from '@/lib/api/admin/types';
import {
  useActivateUser,
  useDeactivateUser,
  usersApi,
  useUsers,
} from '@/lib/api/admin/users';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListParams } from '@/lib/hooks/useListParams';
import { relativeWib } from '@/lib/datetime';

import { AuthorFormDialog } from './AuthorFormDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { UserFormDialog, type UserFormMode } from './UserFormDialog';

type QuickFilter = 'all' | 'admin' | 'authors';

const FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'admin', label: 'Admin (bisa login)' },
  { value: 'authors', label: 'Penulis saja' },
];

type PendingAction = 'author-edit' | 'user-edit' | 'convert';

const helper = createDataTableColumnHelper<UserItem>();

/** Users & authors list (docs 07 §3.12): filters, create/edit/convert dialogs, reset
 * password, and activate/deactivate. */
export function UsersView() {
  const { data: me } = useMe();
  const hasUsersManage = usePermission('users.manage');
  const hasAuthorsManage = usePermission('authors.manage');

  const { params, set } = useListParams({
    page: 1,
    q: '',
    filter: 'all' as QuickFilter,
  });
  const [search, setSearch] = useState(params.q);
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => {
    if (debouncedSearch !== params.q) set({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const canLoginFilter =
    params.filter === 'admin'
      ? true
      : params.filter === 'authors'
        ? false
        : undefined;
  const { data, isLoading } = useUsers({
    page: params.page,
    q: params.q || undefined,
    can_login: canLoginFilter,
  });

  // Dialog state.
  const [authorDialog, setAuthorDialog] = useState<{
    open: boolean;
    user: UserDetail | null;
  }>({
    open: false,
    user: null,
  });
  const [userDialog, setUserDialog] = useState<{
    open: boolean;
    mode: UserFormMode;
    user: UserDetail | null;
  }>({ open: false, mode: 'create', user: null });
  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    user: UserItem | null;
  }>({
    open: false,
    user: null,
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserItem | null;
    action: 'activate' | 'deactivate';
  }>({ open: false, user: null, action: 'deactivate' });

  // Row edit/convert actions fetch the full UserDetail before opening a dialog, so an
  // in-flight submit never overwrites bio/avatar with stale/blank values. Fetched
  // imperatively (not via an effect) so opening the dialog is a direct response to the click.
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function loadDetailThen(row: UserItem, action: PendingAction) {
    setPendingId(row.id);
    try {
      const detail = await qc.fetchQuery({
        queryKey: qk.users.detail(row.id),
        queryFn: () => usersApi.get(row.id),
      });
      if (action === 'author-edit')
        setAuthorDialog({ open: true, user: detail });
      if (action === 'user-edit')
        setUserDialog({ open: true, mode: 'edit', user: detail });
      if (action === 'convert')
        setUserDialog({ open: true, mode: 'convert', user: detail });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPendingId(null);
    }
  }

  function requestEdit(row: UserItem) {
    void loadDetailThen(row, row.can_login ? 'user-edit' : 'author-edit');
  }
  function requestConvert(row: UserItem) {
    void loadDetailThen(row, 'convert');
  }

  const activate = useActivateUser();
  const deactivate = useDeactivateUser();
  const togglePending = activate.isPending || deactivate.isPending;

  async function confirmToggle() {
    const user = confirmDialog.user;
    if (!user) return;
    try {
      if (confirmDialog.action === 'activate')
        await activate.mutateAsync(user.id);
      else await deactivate.mutateAsync(user.id);
      setConfirmDialog((s) => ({ ...s, open: false }));
    } catch (err) {
      toastApiError(err);
    }
  }

  const columns = [
    helper.accessor('display_name', {
      header: 'Nama',
      cell: (ctx) => {
        const row = ctx.row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{row.display_name}</span>
            {row.title ? (
              <span className="text-muted-foreground text-xs">{row.title}</span>
            ) : null}
          </div>
        );
      },
    }),
    helper.accessor('email', {
      header: 'Email',
      cell: (ctx) =>
        ctx.getValue() ?? <span className="text-muted-foreground">—</span>,
    }),
    helper.accessor('roles', {
      header: 'Role',
      cell: (ctx) => {
        const roles = ctx.getValue();
        return roles.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r.id} variant="secondary" className="font-normal">
                {r.name}
              </Badge>
            ))}
          </div>
        );
      },
    }),
    helper.accessor('can_login', {
      header: 'Bisa login',
      cell: (ctx) => (
        <Badge variant="outline" className="font-normal">
          {ctx.getValue() ? 'Ya' : 'Tidak'}
        </Badge>
      ),
      meta: { align: 'center', hideBelow: 'md' },
    }),
    helper.accessor('is_active', {
      header: 'Aktif',
      cell: (ctx) => (
        <StatusBadge status={ctx.getValue() ? 'active' : 'inactive'} />
      ),
      meta: { align: 'center' },
    }),
    helper.accessor('last_login_at', {
      header: 'Login terakhir',
      cell: (ctx) => {
        const v = ctx.getValue();
        return v ? (
          relativeWib(v)
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      meta: { hideBelow: 'lg' },
    }),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna & penulis"
        description="Kelola akun panel admin dan profil penulis artikel."
        actions={
          hasUsersManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gold">
                  <PlusIcon data-icon="inline-start" />
                  Tambah
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setAuthorDialog({ open: true, user: null })}
                >
                  <UserRoundPlusIcon />
                  Tambah penulis
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    setUserDialog({ open: true, mode: 'create', user: null })
                  }
                >
                  <ShieldCheckIcon />
                  Tambah pengguna admin
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : hasAuthorsManage ? (
            <Button
              variant="gold"
              onClick={() => setAuthorDialog({ open: true, user: null })}
            >
              <PlusIcon data-icon="inline-start" />
              Tambah penulis
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        page={params.page}
        onPageChange={(p) => set({ page: p })}
        getRowId={(r) => r.id}
        toolbar={
          <DataTableToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Cari nama atau email…',
            }}
          >
            <ToggleGroup
              type="single"
              variant="outline"
              value={params.filter}
              onValueChange={(v) => v && set({ filter: v as QuickFilter })}
            >
              {FILTERS.map((f) => (
                <ToggleGroupItem
                  key={f.value}
                  value={f.value}
                  className="text-xs"
                >
                  {f.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </DataTableToolbar>
        }
        rowActions={(row) => {
          const isSelf = row.id === me?.id;
          const fetchingThis = pendingId === row.id;
          const canEdit = row.can_login
            ? hasUsersManage
            : hasUsersManage || hasAuthorsManage;
          const canConvert = hasUsersManage && !row.can_login;
          const canReset = hasUsersManage && row.can_login;
          const canToggle = hasUsersManage && !isSelf;
          if (!canEdit && !canConvert && !canReset && !canToggle) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={fetchingThis}>
                  {fetchingThis ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <MoreHorizontalIcon />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit ? (
                  <DropdownMenuItem onSelect={() => requestEdit(row)}>
                    Sunting
                  </DropdownMenuItem>
                ) : null}
                {canConvert ? (
                  <DropdownMenuItem onSelect={() => requestConvert(row)}>
                    <ShieldCheckIcon />
                    Jadikan pengguna admin
                  </DropdownMenuItem>
                ) : null}
                {canReset ? (
                  <DropdownMenuItem
                    onSelect={() => setResetDialog({ open: true, user: row })}
                  >
                    <KeyRoundIcon />
                    Reset kata sandi
                  </DropdownMenuItem>
                ) : null}
                {canToggle ? (
                  <>
                    <DropdownMenuSeparator />
                    {row.is_active ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setConfirmDialog({
                            open: true,
                            user: row,
                            action: 'deactivate',
                          })
                        }
                      >
                        Nonaktifkan
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          setConfirmDialog({
                            open: true,
                            user: row,
                            action: 'activate',
                          })
                        }
                      >
                        Aktifkan
                      </DropdownMenuItem>
                    )}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      <AuthorFormDialog
        open={authorDialog.open}
        onOpenChange={(open) => setAuthorDialog((s) => ({ ...s, open }))}
        user={authorDialog.user}
      />
      <UserFormDialog
        open={userDialog.open}
        onOpenChange={(open) => setUserDialog((s) => ({ ...s, open }))}
        mode={userDialog.mode}
        user={userDialog.user}
      />
      <ResetPasswordDialog
        open={resetDialog.open}
        onOpenChange={(open) => setResetDialog((s) => ({ ...s, open }))}
        user={resetDialog.user}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((s) => ({ ...s, open }))}
        title={
          confirmDialog.action === 'deactivate'
            ? `Nonaktifkan ${confirmDialog.user?.display_name}?`
            : `Aktifkan ${confirmDialog.user?.display_name}?`
        }
        description={
          confirmDialog.action === 'deactivate'
            ? 'Pengguna ini tidak akan bisa masuk ke panel admin sampai diaktifkan kembali.'
            : 'Pengguna ini akan dapat masuk kembali ke panel admin.'
        }
        confirmLabel={
          confirmDialog.action === 'deactivate' ? 'Nonaktifkan' : 'Aktifkan'
        }
        destructive={confirmDialog.action === 'deactivate'}
        onConfirm={confirmToggle}
        loading={togglePending}
      />
    </div>
  );
}
