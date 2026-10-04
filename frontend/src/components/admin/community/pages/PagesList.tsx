'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CopyIcon,
  FileTextIcon,
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
import { useDeletePage, usePages } from '@/lib/api/admin/pages';
import type { AdminPage } from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useListParams } from '@/lib/hooks/useListParams';
import { DRAFT_PREFIX, writeDraft } from '@/lib/hooks/useLocalDraft';

import { PAGE_DUPLICATE_DRAFT_KEY, pageDuplicateDraft } from './PageForm';

const column = createDataTableColumnHelper<AdminPage>();

export function PagesList() {
  const router = useRouter();
  const { params, set } = useListParams({ q: '', status: '' });
  const [toDelete, setToDelete] = useState<AdminPage | null>(null);

  const query = usePages();
  const del = useDeletePage();

  const items = useMemo(() => {
    const all = query.data ?? [];
    const q = params.q.trim().toLowerCase();
    return all.filter((it) => {
      if (params.status && it.status !== params.status) return false;
      if (q && !it.title.toLowerCase().includes(q) && !it.slug.includes(q))
        return false;
      return true;
    });
  }, [query.data, params.q, params.status]);

  function duplicate(item: AdminPage) {
    writeDraft(
      DRAFT_PREFIX + PAGE_DUPLICATE_DRAFT_KEY,
      pageDuplicateDraft(item),
    );
    router.push('/admin/pages/new');
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Halaman dihapus.');
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
            href={`/admin/pages/${ctx.row.original.id}`}
            className="font-medium hover:underline"
          >
            {ctx.getValue()}
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            /halaman/{ctx.row.original.slug}
          </span>
        </div>
      ),
    }),
    column.accessor('updated_at', {
      header: 'Diperbarui',
      cell: (ctx) => formatWib(ctx.getValue(), 'd MMM yyyy, HH:mm'),
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
        title="Halaman statis"
        description="Halaman informasi yang tampil di /halaman/{slug}."
        actions={
          <Button asChild variant="gold">
            <Link href="/admin/pages/new">
              <PlusIcon data-icon="inline-start" />
              Tambah halaman
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={items}
        isLoading={query.isFetching}
        page={1}
        onPageChange={() => {}}
        getRowId={(row) => row.id}
        toolbar={
          <DataTableToolbar
            search={{
              value: params.q,
              onChange: (v) => set({ q: v }),
              placeholder: 'Cari halaman…',
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
              </SelectContent>
            </Select>
          </DataTableToolbar>
        }
        empty={
          <EmptyState
            icon={FileTextIcon}
            title="Belum ada halaman"
            description="Tambahkan halaman statis pertama Anda."
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
                <Link href={`/admin/pages/${row.id}`}>
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
        title="Hapus halaman"
        description={`Hapus halaman "${toDelete?.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus halaman"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
