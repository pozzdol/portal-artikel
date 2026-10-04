'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ClapperboardIcon,
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
import { useDeleteVideo, useVideos } from '@/lib/api/admin/videos';
import type { AdminVideo } from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListParams } from '@/lib/hooks/useListParams';
import { DRAFT_PREFIX, writeDraft } from '@/lib/hooks/useLocalDraft';

import { VIDEO_DUPLICATE_DRAFT_KEY, videoDuplicateDraft } from './VideoForm';

const column = createDataTableColumnHelper<AdminVideo>();

function durationLabel(total: number | null): string {
  if (total == null) return '—';
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function VideosList() {
  const router = useRouter();
  const { params, set } = useListParams({ page: 1, q: '', status: '' });
  const [search, setSearch] = useState(params.q);
  const debouncedQ = useDebounce(search, 400);
  const [toDelete, setToDelete] = useState<AdminVideo | null>(null);

  const query = useVideos({
    page: params.page,
    per_page: 20,
    q: debouncedQ || undefined,
    status: (params.status || undefined) as AdminVideo['status'] | undefined,
  });
  const del = useDeleteVideo();

  useEffect(() => {
    if (debouncedQ !== params.q) set({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const items = query.data?.items ?? [];

  function duplicate(item: AdminVideo) {
    writeDraft(
      DRAFT_PREFIX + VIDEO_DUPLICATE_DRAFT_KEY,
      videoDuplicateDraft(item),
    );
    router.push('/admin/videos/new');
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success('Video dihapus.');
      setToDelete(null);
    } catch (err) {
      toastApiError(err);
    }
  }

  const columns = column.columns([
    column.display({
      id: 'thumb',
      header: '',
      cell: ({ row }) => (
        <div className="bg-muted border-line relative aspect-video w-24 overflow-hidden border">
          <Image
            src={`https://i.ytimg.com/vi/${row.original.youtube_id}/default.jpg`}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
            unoptimized
          />
        </div>
      ),
    }),
    column.accessor('title', {
      header: 'Judul',
      cell: (ctx) => (
        <Link
          href={`/admin/videos/${ctx.row.original.id}`}
          className="font-medium hover:underline"
        >
          {ctx.getValue()}
        </Link>
      ),
    }),
    column.accessor('duration_seconds', {
      header: 'Durasi',
      cell: (ctx) => durationLabel(ctx.getValue()),
    }),
    column.accessor('published_at', {
      header: 'Terbit',
      cell: (ctx) => formatWib(ctx.getValue(), 'd MMM yyyy'),
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
        title="Video"
        description="Video YouTube yang tampil di /video."
        actions={
          <Button asChild variant="gold">
            <Link href="/admin/videos/new">
              <PlusIcon data-icon="inline-start" />
              Tambah video
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={items}
        meta={query.data?.meta}
        isLoading={query.isFetching}
        page={params.page}
        onPageChange={(page) => set({ page }, { resetPage: false })}
        getRowId={(row) => row.id}
        toolbar={
          <DataTableToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Cari video…',
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
            icon={ClapperboardIcon}
            title="Belum ada video"
            description="Tambahkan video YouTube pertama Anda."
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
                <Link href={`/admin/videos/${row.id}`}>
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
        title="Hapus video"
        description={`Hapus video "${toDelete?.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus video"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
