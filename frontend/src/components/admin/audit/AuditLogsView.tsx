'use client';

import { ChevronRightIcon } from 'lucide-react';

import { Combobox } from '@/components/admin/Combobox';
import {
  createDataTableColumnHelper,
  DataTable,
} from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/shadcn/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { DateRangePicker } from '@/components/ui/pickers';
import { useAuditLogs } from '@/lib/api/admin/audit';
import type { AuditLog } from '@/lib/api/admin/types';
import { useUsers } from '@/lib/api/admin/users';
import { formatWib } from '@/lib/datetime';
import { useListParams } from '@/lib/hooks/useListParams';

import {
  actionLabel,
  ACTIONS,
  entityHref,
  entityLabel,
  ENTITY_TYPES,
} from './constants';

const helper = createDataTableColumnHelper<AuditLog>();

function ChangesCell({ changes }: { changes: unknown }) {
  if (changes === undefined || changes === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-xs">
        <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        Lihat perubahan
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="bg-muted mt-2 max-h-64 max-w-md overflow-auto p-2 text-xs whitespace-pre-wrap">
          {JSON.stringify(changes, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Activity log list (docs 07 §3.13): entity/action/user filters, a WIB date range, and each
 * row's raw `changes` behind a Collapsible. */
export function AuditLogsView() {
  const hasUsersPerm = usePermission('users.manage', 'authors.manage');
  const { data: usersData } = useUsers(
    { per_page: 100 },
    { enabled: hasUsersPerm },
  );

  const { params, set } = useListParams({
    page: 1,
    entity_type: 'all',
    action: 'all',
    user_id: 0,
    from: '',
    to: '',
  });

  const { data, isLoading } = useAuditLogs({
    page: params.page,
    entity_type: params.entity_type === 'all' ? undefined : params.entity_type,
    action: params.action === 'all' ? undefined : params.action,
    user_id: params.user_id || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  });

  const columns = [
    helper.accessor('created_at', {
      header: 'Waktu',
      cell: (ctx) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatWib(ctx.getValue(), 'd MMM yyyy, HH:mm')}
        </span>
      ),
    }),
    helper.accessor('user', {
      header: 'Pengguna',
      cell: (ctx) =>
        ctx.getValue()?.display_name ?? (
          <span className="text-muted-foreground">Sistem</span>
        ),
    }),
    helper.accessor('action', {
      header: 'Aksi',
      cell: (ctx) => (
        <Badge variant="outline" className="font-normal">
          {actionLabel(ctx.getValue())}
        </Badge>
      ),
    }),
    helper.display({
      id: 'entity',
      header: 'Entitas',
      cell: (ctx) => {
        const row = ctx.row.original;
        const label = `${entityLabel(row.entity_type)}${row.entity_id ? ` #${row.entity_id}` : ''}`;
        const href = entityHref(row.entity_type, row.entity_id);
        return href ? (
          <a
            href={href}
            className="hover:text-gold-strong underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          label
        );
      },
    }),
    helper.accessor('summary', {
      header: 'Ringkasan',
      cell: (ctx) => <span className="text-sm">{ctx.getValue()}</span>,
      meta: { hideBelow: 'md' },
    }),
    helper.accessor('changes', {
      header: 'Perubahan',
      cell: (ctx) => <ChangesCell changes={ctx.getValue()} />,
      meta: { hideBelow: 'lg' },
    }),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Log aktivitas"
        description="Riwayat aksi yang dilakukan pengguna di panel admin."
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
          <DataTableToolbar>
            <Select
              value={params.entity_type}
              onValueChange={(v) => set({ entity_type: v })}
            >
              <SelectTrigger className="w-44" aria-label="Tipe entitas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua entitas</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {entityLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={params.action}
              onValueChange={(v) => set({ action: v })}
            >
              <SelectTrigger className="w-44" aria-label="Aksi">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua aksi</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasUsersPerm ? (
              <Combobox
                items={usersData?.items ?? []}
                value={params.user_id || null}
                onChange={(v) => set({ user_id: (v as number) || 0 })}
                getKey={(u) => u.id}
                getLabel={(u) => u.display_name}
                placeholder="Semua pengguna"
                allowClear
                className="w-48"
              />
            ) : null}
            <DateRangePicker
              value={{
                from: params.from || undefined,
                to: params.to || undefined,
              }}
              onChange={(v) => set({ from: v.from ?? '', to: v.to ?? '' })}
            />
          </DataTableToolbar>
        }
      />
    </div>
  );
}
