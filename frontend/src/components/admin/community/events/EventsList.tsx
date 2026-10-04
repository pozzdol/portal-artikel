'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarPlusIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  DataTable,
  createDataTableColumnHelper,
} from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { useDeleteEvent, useEvents } from '@/lib/api/admin/events';
import type { AdminEvent } from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListParams } from '@/lib/hooks/useListParams';
import { DRAFT_PREFIX, writeDraft } from '@/lib/hooks/useLocalDraft';

import { DUPLICATE_DRAFT_KEY, eventDuplicateDraft } from './EventForm';

const column = createDataTableColumnHelper<AdminEvent>();

function when(item: AdminEvent): 'upcoming' | 'past' {
  return new Date(item.starts_at).getTime() >= Date.now() ? 'upcoming' : 'past';
}

export function EventsList() {
  const router = useRouter();
  const { params, set } = useListParams({
    page: 1,
    q: '',
    status: '',
    when: '',
  });
  const [search, setSearch] = useState(params.q);
  const debouncedQ = useDebounce(search, 400);
  const [toDelete, setToDelete] = useState<AdminEvent | null>(null);

  const query = useEvents({
    page: params.page,
    per_page: 20,
    q: debouncedQ || undefined,
    status: (params.status || undefined) as AdminEvent['status'] | undefined,
  });
  const del = useDeleteEvent();

  useEffect(() => {
    if (debouncedQ !== params.q) set({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (!params.when) return all;
    return all.filter((it) => when(it) === params.when);
  }, [query.data, params.when]);

  function duplicate(item: AdminEvent) {
    writeDraft(DRAFT_PREFIX + DUPLICATE_DRAFT_KEY, eventDuplicateDraft(item));
    router.push('/admin/events/new');
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Agenda dihapus.');
      setToDelete(null);
    } catch (err) {
      toastApiError(err);
    }
  }

  const columns = column.columns([
    column.accessor('title', {
      header: 'Judul',
      cell: (ctx) => (
        <div className="flex flex-col">
          <Link
            href={`/admin/events/${ctx.row.original.id}`}
            className="font-medium hover:underline"
          >
            {ctx.getValue()}
          </Link>
          <span className="text-muted-foreground text-xs">
            {ctx.row.original.location_name}
          </span>
        </div>
      ),
    }),
    column.accessor('starts_at', {
      header: 'Mulai',
      cell: (ctx) =>
        formatWib(
          ctx.getValue(),
          ctx.row.original.is_all_day ? 'd MMM yyyy' : 'd MMM yyyy, HH:mm',
        ),
    }),
    column.accessor('status', {
      header: 'Status',
      cell: (ctx) => <StatusBadge status={ctx.getValue()} />,
    }),
  ]);

  if (query.isLoading && !query.data) return <ListPageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Acara komunitas alumni yang tampil di /agenda."
        actions={
          <Button asChild variant="gold">
            <Link href="/admin/events/new">
              <PlusIcon data-icon="inline-start" />
              Tambah agenda
            </Link>
          </Button>
        }
      />

      <Tabs
        value={params.when || 'all'}
        onValueChange={(v) => set({ when: v === 'all' ? '' : v })}
      >
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="upcoming">Mendatang</TabsTrigger>
          <TabsTrigger value="past">Selesai</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={items}
        meta={params.when ? undefined : query.data?.meta}
        isLoading={query.isFetching}
        page={params.page}
        onPageChange={(page) => set({ page }, { resetPage: false })}
        getRowId={(row) => row.id}
        toolbar={
          <DataTableToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Cari agenda…',
            }}
          >
            <Select
              value={params.status || 'all'}
              onValueChange={(v) => set({ status: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="draft">Draf</SelectItem>
                <SelectItem value="published">Terbit</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </DataTableToolbar>
        }
        empty={
          <EmptyState
            icon={CalendarPlusIcon}
            title="Belum ada agenda"
            description="Tambahkan acara komunitas pertama Anda."
          />
        }
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Aksi lainnya">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/events/${row.id}`}>
                  <PencilIcon data-icon="inline-start" />
                  Sunting
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicate(row)}>
                <CopyIcon data-icon="inline-start" />
                Duplikat
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setToDelete(row)}
              >
                <TrashIcon data-icon="inline-start" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus agenda"
        description={`Hapus agenda "${toDelete?.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus agenda"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
