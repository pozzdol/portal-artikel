'use client';

import Image from 'next/image';
import { useState } from 'react';
import { CheckIcon, CopyIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/shadcn/alert-dialog';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import { Input } from '@/components/ui/shadcn/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/shadcn/sheet';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  useDeleteMedia,
  useMediaItem,
  useUpdateMedia,
} from '@/lib/api/admin/media';
import type { MediaItem } from '@/lib/api/admin/types';
import { isApiClientError } from '@/lib/api/client';
import { formatWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';

import { formatBytes } from './upload-rules';

export type MediaDetailSheetProps = {
  mediaId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful delete (the sheet closes itself). */
  onDeleted?: (id: number) => void;
};

const ALT_MAX = 255;
const CAPTION_MAX = 500;

export function MediaDetailSheet({
  mediaId,
  open,
  onOpenChange,
  onDeleted,
}: MediaDetailSheetProps) {
  const {
    data: item,
    isLoading,
    isError,
  } = useMediaItem(mediaId, {
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-line border-b">
          <SheetTitle className="font-serif text-xl">Detail media</SheetTitle>
          <SheetDescription className="truncate">
            {item ? item.original_name : 'Memuat…'}
          </SheetDescription>
        </SheetHeader>
        {isLoading || (!item && !isError) ? (
          <DetailSkeleton />
        ) : isError || !item ? (
          <p className="text-muted-foreground p-4 text-sm">
            Media tidak ditemukan atau sudah dihapus.
          </p>
        ) : (
          // Re-mount the form when another item (or a fresh save) arrives.
          <DetailBody
            key={`${item.id}`}
            item={item}
            onDeleted={() => {
              onOpenChange(false);
              onDeleted?.(item.id);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function DetailBody({
  item,
  onDeleted,
}: {
  item: MediaItem;
  onDeleted: () => void;
}) {
  const [alt, setAlt] = useState(item.alt_text ?? '');
  const [caption, setCaption] = useState(item.caption ?? '');
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateMedia();
  const del = useDeleteMedia();

  const dirty =
    alt.trim() !== (item.alt_text ?? '') ||
    caption.trim() !== (item.caption ?? '');

  const save = () => {
    update.mutate(
      {
        id: item.id,
        input: {
          alt_text: alt.trim() || null,
          caption: caption.trim() || null,
        },
      },
      {
        onSuccess: (saved) => {
          setAlt(saved.alt_text ?? '');
          setCaption(saved.caption ?? '');
          toast.success('Detail media disimpan.');
        },
        onError: (err) => toastApiError(err),
      },
    );
  };

  const copyUrl = async () => {
    const abs = new URL(item.url, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Gagal menyalin URL. Salin secara manual.');
    }
  };

  const confirmDelete = () => {
    del.mutate(item.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success('Media dihapus.');
        onDeleted();
      },
      onError: (err) => {
        setConfirmOpen(false);
        if (isApiClientError(err) && err.status === 409) {
          toast.error('Media masih dipakai sehingga tidak bisa dihapus.', {
            description:
              'Lepaskan media ini dari artikel, agenda, tokoh, video, halaman, atau pengaturan terlebih dahulu.',
          });
          return;
        }
        toastApiError(err);
      },
    });
  };

  const dims =
    item.width && item.height ? `${item.width} × ${item.height} px` : '—';

  return (
    <>
      <div className="flex flex-col gap-5 p-4">
        <div className="border-line bg-muted relative flex aspect-video w-full items-center justify-center overflow-hidden border">
          <Image
            src={item.url}
            alt={item.alt_text ?? ''}
            fill
            sizes="(min-width: 640px) 448px, 100vw"
            className="object-contain"
            unoptimized={item.mime_type === 'image/gif'}
          />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Dimensi</dt>
          <dd className="tabular-nums">{dims}</dd>
          <dt className="text-muted-foreground">Ukuran</dt>
          <dd className="tabular-nums">{formatBytes(item.size_bytes)}</dd>
          <dt className="text-muted-foreground">Tipe</dt>
          <dd>{item.mime_type}</dd>
          <dt className="text-muted-foreground">Diunggah</dt>
          <dd>{formatWib(item.created_at, "d MMM yyyy, HH:mm 'WIB'")}</dd>
        </dl>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={`media-url-${item.id}`}>URL</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`media-url-${item.id}`}
                value={item.url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={copyUrl}
                  aria-label="Salin URL"
                  title="Salin URL"
                >
                  {copied ? <CheckIcon className="text-gold" /> : <CopyIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {copied && (
              <FieldDescription role="status">URL disalin.</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={`media-alt-${item.id}`}>
              Teks alternatif
            </FieldLabel>
            <Input
              id={`media-alt-${item.id}`}
              value={alt}
              maxLength={ALT_MAX}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Deskripsikan isi gambar"
            />
            <FieldDescription>
              Dibacakan pembaca layar dan tampil jika gambar gagal dimuat.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`media-caption-${item.id}`}>
              Keterangan
            </FieldLabel>
            <Textarea
              id={`media-caption-${item.id}`}
              value={caption}
              maxLength={CAPTION_MAX}
              rows={3}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Contoh: Foto: Tim Media"
            />
          </Field>
        </FieldGroup>
      </div>

      <SheetFooter className="border-line mt-auto flex-row items-center justify-between border-t">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={del.isPending}
        >
          <Trash2Icon data-icon="inline-start" />
          Hapus
        </Button>
        <Button
          type="button"
          variant="gold"
          onClick={save}
          disabled={!dirty || update.isPending}
        >
          {update.isPending && <Spinner data-icon="inline-start" />}
          Simpan
        </Button>
      </SheetFooter>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !del.isPending && setConfirmOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus media ini?</AlertDialogTitle>
            <AlertDialogDescription>
              File “{item.original_name}” akan dihapus permanen. Media yang
              masih dipakai konten tidak bisa dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {del.isPending && <Spinner data-icon="inline-start" />}
              Hapus media
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
