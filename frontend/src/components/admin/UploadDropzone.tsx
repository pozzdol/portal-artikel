'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  ImageUpIcon,
  RotateCwIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Progress } from '@/components/ui/shadcn/progress';
import { useUploadMedia } from '@/lib/api/admin/media';
import { isApiClientError } from '@/lib/api/client';
import type { MediaItem } from '@/lib/api/admin/types';
import { cn } from '@/lib/cn';

import {
  formatBytes,
  inputAccept,
  precheckFile,
  uploadErrorMessage,
} from './media/upload-rules';

export type UploadDropzoneProps = {
  /** Called once per successfully uploaded file. */
  onUploaded: (item: MediaItem) => void;
  multiple?: boolean;
  /** MIME prefix filter, e.g. "image" or "image/png". */
  accept?: string;
  disabled?: boolean;
  className?: string;
};

type EntryStatus = 'queued' | 'uploading' | 'done' | 'error';

type Entry = {
  key: string;
  file: File;
  status: EntryStatus;
  progress: number;
  error?: string;
  /** False for rejections that a retry cannot fix (pre-check, 413, 415). */
  retryable?: boolean;
};

/** Parallel uploads per dropzone. */
const CONCURRENCY = 2;

let seq = 0;
const nextKey = () => `u${++seq}`;

export function UploadDropzone({
  onUploaded,
  multiple = false,
  accept,
  disabled,
  className,
}: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  // Keys already handed to start(); guards against double starts.
  const started = useRef(new Set<string>());
  const onUploadedRef = useRef(onUploaded);
  const { mutateAsync } = useUploadMedia();

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  // Abort in-flight uploads when the dropzone unmounts (dialog closed).
  useEffect(() => {
    const map = controllers.current;
    return () => {
      for (const c of map.values()) c.abort();
      map.clear();
    };
  }, []);

  const patch = useCallback((key: string, p: Partial<Entry>) => {
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...p } : e)));
  }, []);

  const start = useCallback(
    async (entry: Entry) => {
      const ctrl = new AbortController();
      controllers.current.set(entry.key, ctrl);
      patch(entry.key, { status: 'uploading', progress: 0, error: undefined });
      try {
        const item = await mutateAsync({
          file: entry.file,
          signal: ctrl.signal,
          onProgress: (f) =>
            patch(entry.key, { progress: Math.round(f * 100) }),
        });
        patch(entry.key, { status: 'done', progress: 100 });
        onUploadedRef.current(item);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const permanent =
          isApiClientError(err) && [413, 415, 422].includes(err.status);
        patch(entry.key, {
          status: 'error',
          error: uploadErrorMessage(err),
          retryable: !permanent,
        });
      } finally {
        controllers.current.delete(entry.key);
      }
    },
    [mutateAsync, patch],
  );

  // Simple scheduler: keep up to CONCURRENCY uploads running.
  useEffect(() => {
    const running = entries.filter((e) => e.status === 'uploading').length;
    const free = CONCURRENCY - running;
    if (free <= 0) return;
    const next = entries.filter((e) => e.status === 'queued').slice(0, free);
    for (const e of next) {
      if (started.current.has(e.key)) continue;
      started.current.add(e.key);
      void start(e);
    }
  }, [entries, start]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      if (files.length === 0) return;
      const picked = multiple ? files : files.slice(0, 1);
      const fresh: Entry[] = picked.map((file) => {
        const error = precheckFile(file, accept);
        return {
          key: nextKey(),
          file,
          status: error ? 'error' : 'queued',
          progress: 0,
          error: error ?? undefined,
        };
      });
      setEntries((prev) => (multiple ? [...prev, ...fresh] : fresh));
    },
    [accept, multiple],
  );

  const remove = (key: string) => {
    controllers.current.get(key)?.abort();
    setEntries((list) => list.filter((e) => e.key !== key));
  };

  const retry = (key: string) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry || !entry.retryable) return;
    started.current.delete(key);
    patch(key, { status: 'queued', error: undefined, progress: 0 });
  };

  const clearFinished = () =>
    setEntries((list) => list.filter((e) => e.status !== 'done'));

  const hasFinished = entries.some((e) => e.status === 'done');

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-foreground/25 flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors',
          'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-3',
          dragging
            ? 'border-gold bg-gold/10'
            : 'hover:border-foreground/50 hover:bg-muted/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <ImageUpIcon
          className={cn(
            'size-8',
            dragging ? 'text-gold' : 'text-muted-foreground',
          )}
          aria-hidden
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {dragging
              ? 'Lepaskan untuk mengunggah'
              : multiple
                ? 'Seret gambar ke sini, atau klik untuk memilih beberapa file'
                : 'Seret gambar ke sini, atau klik untuk memilih file'}
          </span>
          <span className="text-muted-foreground text-xs">
            JPEG, PNG, GIF, atau WebP. Maksimal 5 MB per file.
          </span>
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={inputAccept(accept)}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="divide-line border-line flex flex-col divide-y border">
            {entries.map((e) => (
              <UploadRow
                key={e.key}
                entry={e}
                canRetry={e.status === 'error' && !!e.retryable}
                onRemove={() => remove(e.key)}
                onRetry={() => retry(e.key)}
              />
            ))}
          </ul>
          {hasFinished && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={clearFinished}
            >
              Bersihkan yang selesai
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function UploadRow({
  entry,
  canRetry,
  onRemove,
  onRetry,
}: {
  entry: Entry;
  canRetry: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { file, status, progress, error } = entry;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="shrink-0" aria-hidden>
        {status === 'done' ? (
          <CircleCheckIcon className="text-gold size-4" />
        ) : status === 'error' ? (
          <CircleAlertIcon className="text-destructive size-4" />
        ) : (
          <ImageUpIcon className="text-muted-foreground size-4" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate" title={file.name}>
            {file.name}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {status === 'uploading'
              ? `${progress}%`
              : status === 'queued'
                ? 'Menunggu'
                : status === 'done'
                  ? 'Selesai'
                  : formatBytes(file.size)}
          </span>
        </div>
        {status === 'error' ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : (
          <Progress
            value={progress}
            aria-label={`Progres unggah ${file.name}`}
            className={cn(
              'h-1 rounded-none',
              status === 'done' && '[&>[data-slot=progress-indicator]]:bg-gold',
            )}
          />
        )}
      </div>
      {canRetry && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRetry}
          aria-label={`Coba lagi ${file.name}`}
        >
          <RotateCwIcon />
        </Button>
      )}
      {status !== 'done' && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={
            status === 'uploading'
              ? `Batalkan unggahan ${file.name}`
              : `Hapus ${file.name} dari daftar`
          }
        >
          <XIcon />
        </Button>
      )}
    </li>
  );
}
