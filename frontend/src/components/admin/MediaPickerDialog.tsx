'use client';

import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImagesIcon,
  SearchIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/shadcn/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import { useMediaList } from '@/lib/api/admin/media';
import type { MediaItem } from '@/lib/api/admin/types';
import { apiErrorMessage } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';

import { MediaGrid } from './media/MediaGrid';
import { UploadDropzone } from './UploadDropzone';

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** MIME prefix filter, e.g. "image" (default) or "image/png". */
  accept?: string;
  title?: string;
};

export type MediaPickerDialogProps = BaseProps &
  (
    | { multiple?: false; onSelect: (item: MediaItem) => void }
    | { multiple: true; onSelect: (items: MediaItem[]) => void }
  );

const PER_PAGE = 20;

/**
 * Media library picker. Mount it only where needed; state resets whenever
 * the dialog closes (the body unmounts).
 */
export function MediaPickerDialog(props: MediaPickerDialogProps) {
  const { open, onOpenChange, multiple, title } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {title ?? 'Pilih gambar'}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? 'Pilih satu atau beberapa gambar dari pustaka, atau unggah yang baru.'
              : 'Pilih gambar dari pustaka, atau unggah yang baru.'}
          </DialogDescription>
        </DialogHeader>
        {open && <PickerBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody(props: MediaPickerDialogProps) {
  const { accept = 'image', onOpenChange } = props;
  const multiple = props.multiple === true;
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  // Ordered selection; items are kept so uploads can be selected directly.
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const debouncedQ = useDebounce(q.trim(), 300);

  const list = useMediaList({
    q: debouncedQ || undefined,
    type: accept,
    page,
    per_page: PER_PAGE,
  });
  const items = list.data?.items ?? [];
  const meta = list.data?.meta;
  const totalPages = Math.max(1, meta?.total_pages ?? 1);

  const toggle = (item: MediaItem) => {
    setSelected((cur) => {
      const has = cur.some((s) => s.id === item.id);
      if (!multiple) return has ? [] : [item];
      return has ? cur.filter((s) => s.id !== item.id) : [...cur, item];
    });
  };

  const addUploaded = (item: MediaItem) => {
    setSelected((cur) =>
      multiple
        ? cur.some((s) => s.id === item.id)
          ? cur
          : [...cur, item]
        : [item],
    );
  };

  const confirm = () => {
    if (selected.length === 0) return;
    if (props.multiple === true) props.onSelect(selected);
    else props.onSelect(selected[0]);
    onOpenChange(false);
  };

  const selectedIds = selected.map((s) => s.id);

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'library' | 'upload')}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList
          variant="line"
          className="border-line w-full justify-start border-b"
        >
          <TabsTrigger value="library" className="flex-none px-3">
            Pustaka
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-none px-3">
            Unggah
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="library"
          className="flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden"
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama file…"
              aria-label="Cari media"
            />
          </InputGroup>

          <div className="min-h-[240px] flex-1 overflow-y-auto pr-1">
            {list.isError ? (
              <Empty className="border-line border">
                <EmptyHeader>
                  <EmptyTitle>Gagal memuat pustaka</EmptyTitle>
                  <EmptyDescription>
                    {apiErrorMessage(list.error)}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => list.refetch()}
                >
                  Coba lagi
                </Button>
              </Empty>
            ) : !list.isLoading && items.length === 0 ? (
              <Empty className="border-line border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImagesIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {debouncedQ ? 'Tidak ada hasil' : 'Pustaka masih kosong'}
                  </EmptyTitle>
                  <EmptyDescription>
                    {debouncedQ
                      ? `Tidak ada media yang cocok dengan “${debouncedQ}”.`
                      : 'Unggah gambar pertama lewat tab Unggah.'}
                  </EmptyDescription>
                </EmptyHeader>
                {!debouncedQ && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTab('upload')}
                  >
                    Unggah gambar
                  </Button>
                )}
              </Empty>
            ) : (
              <MediaGrid
                items={items}
                selectedIds={selectedIds}
                onSelect={toggle}
                isLoading={list.isLoading || list.isPlaceholderData}
              />
            )}
          </div>

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {meta.total} media, halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1 || list.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= totalPages || list.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="upload"
          forceMount
          className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <UploadDropzone
            multiple={multiple}
            accept={accept}
            onUploaded={addUploaded}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Gambar yang berhasil diunggah langsung terpilih.
          </p>
        </TabsContent>
      </Tabs>

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-muted-foreground text-sm" aria-live="polite">
          {selected.length === 0
            ? 'Belum ada yang dipilih'
            : multiple
              ? `${selected.length} gambar dipilih`
              : selected[0].original_name}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="gold"
            onClick={confirm}
            disabled={selected.length === 0}
          >
            {multiple && selected.length > 0
              ? `Pakai ${selected.length} gambar`
              : 'Pakai gambar'}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
