'use client';

import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImagesIcon,
  UploadIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { UploadDropzone } from '@/components/admin/UploadDropzone';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useMediaList } from '@/lib/api/admin/media';
import type { MediaItem } from '@/lib/api/admin/types';
import { apiErrorMessage } from '@/lib/forms/serverErrors';
import { useListParams } from '@/lib/hooks/useListParams';

import { MediaDetailSheet } from './MediaDetailSheet';
import { MediaGrid } from './MediaGrid';

const PER_PAGE = 24;
const ALL_TYPES = 'all';

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: ALL_TYPES, label: 'Semua tipe' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'image/webp', label: 'WebP' },
];

/** Media library: grid, search, type filter, pagination, multi-upload, detail sheet. */
export function MediaLibraryPage() {
  const { params, set } = useListParams({ q: '', type: ALL_TYPES, page: 1 });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const type = params.type === ALL_TYPES ? undefined : params.type;
  const list = useMediaList({
    q: params.q || undefined,
    type,
    page: params.page,
    per_page: PER_PAGE,
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.total_pages ?? 1);

  function handleUploaded(item: MediaItem) {
    toast.success(`"${item.original_name}" diunggah.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pustaka media"
        description="Semua gambar yang bisa dipakai di artikel, agenda, tokoh, video, dan halaman."
        actions={
          <Button variant="gold" onClick={() => setUploadOpen(true)}>
            <UploadIcon data-icon="inline-start" />
            Unggah gambar
          </Button>
        }
      />

      <DataTableToolbar
        search={{
          value: params.q,
          onChange: (q) => set({ q }),
          placeholder: 'Cari nama file…',
        }}
      >
        <Select value={params.type} onValueChange={(v) => set({ type: v })}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {list.isError ? (
        <EmptyState
          icon={ImagesIcon}
          title="Gagal memuat pustaka"
          description={apiErrorMessage(list.error)}
          action={
            <Button variant="outline" onClick={() => list.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : !list.isLoading && items.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={params.q ? 'Tidak ada hasil' : 'Pustaka masih kosong'}
          description={
            params.q
              ? `Tidak ada media yang cocok dengan "${params.q}".`
              : 'Unggah gambar pertama untuk mulai mengisi pustaka.'
          }
          action={
            !params.q ? (
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <UploadIcon data-icon="inline-start" />
                Unggah gambar
              </Button>
            ) : undefined
          }
        />
      ) : (
        <MediaGrid
          items={items}
          selectedIds={detailId ? [detailId] : []}
          onSelect={(item) => setDetailId(item.id)}
          isLoading={list.isLoading || list.isPlaceholderData}
        />
      )}

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {meta.total} media, halaman {params.page} dari {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={params.page <= 1 || list.isFetching}
              onClick={() =>
                set({ page: params.page - 1 }, { resetPage: false })
              }
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={params.page >= totalPages || list.isFetching}
              onClick={() =>
                set({ page: params.page + 1 }, { resetPage: false })
              }
              aria-label="Halaman berikutnya"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              Unggah gambar
            </DialogTitle>
            <DialogDescription>
              JPEG, PNG, GIF, atau WebP, maksimal 5 MB per file. Beberapa file
              sekaligus didukung.
            </DialogDescription>
          </DialogHeader>
          <UploadDropzone multiple accept="image" onUploaded={handleUploaded} />
        </DialogContent>
      </Dialog>

      <MediaDetailSheet
        mediaId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onDeleted={() => setDetailId(null)}
      />
    </div>
  );
}
