'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import { ImageIcon, ImageOffIcon, RefreshCwIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { useMediaByIds } from '@/lib/api/admin/media';
import type { MediaItem } from '@/lib/api/admin/types';
import { cn } from '@/lib/cn';

import { MediaPickerDialog } from './MediaPickerDialog';

export type MediaAspect = '16/9' | '4/3' | '3/4' | '1/1';

export type MediaFieldProps = {
  value: number | null;
  onChange: (id: number | null, item?: MediaItem) => void;
  label: string;
  aspect?: MediaAspect;
  description?: string;
  /** Validation message (e.g. from react-hook-form). */
  error?: string;
  disabled?: boolean;
  className?: string;
};

const ASPECT_CLASS: Record<MediaAspect, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
};

// Portrait/square previews would get too tall at full width.
const WIDTH_CLASS: Record<MediaAspect, string> = {
  '16/9': 'max-w-md',
  '4/3': 'max-w-sm',
  '3/4': 'max-w-[13rem]',
  '1/1': 'max-w-[15rem]',
};

export function MediaField({
  value,
  onChange,
  label,
  aspect = '16/9',
  description,
  error,
  disabled,
  className,
}: MediaFieldProps) {
  const id = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { byId, isLoading, isError } = useMediaByIds([value]);
  const item = value ? byId.get(value) : undefined;
  const missing = !!value && !isLoading && !isError && !item;

  const frame = cn(
    'relative w-full overflow-hidden border',
    ASPECT_CLASS[aspect],
    WIDTH_CLASS[aspect],
  );

  return (
    <Field data-invalid={!!error || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      {!value ? (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          data-invalid={!!error || undefined}
          aria-label={`${label}: pilih gambar`}
          className={cn(
            frame,
            'border-foreground/25 bg-muted/40 text-muted-foreground flex flex-col items-center justify-center gap-2 border-dashed transition-colors outline-none',
            'hover:border-gold hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-3',
            'data-invalid:border-destructive disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <ImageIcon className="size-6" aria-hidden />
          <span className="text-sm font-medium">Pilih gambar</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={cn(frame, 'border-line bg-muted')}>
            {isLoading ? (
              <Skeleton className="absolute inset-0" />
            ) : item ? (
              <Image
                src={item.url}
                alt={item.alt_text ?? ''}
                fill
                sizes="448px"
                className="object-cover"
                unoptimized={item.mime_type === 'image/gif'}
              />
            ) : (
              <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-xs">
                <ImageOffIcon className="size-5" aria-hidden />
                {missing
                  ? `Media #${value} tidak ditemukan.`
                  : 'Pratinjau gagal dimuat.'}
              </div>
            )}
          </div>
          <div
            className={cn(
              'flex w-full flex-wrap items-center gap-x-2 gap-y-1',
              WIDTH_CLASS[aspect],
            )}
          >
            <span
              className="text-muted-foreground min-w-32 flex-1 truncate text-xs"
              title={item?.original_name}
            >
              {item
                ? `${item.original_name}${item.width && item.height ? `, ${item.width}×${item.height}` : ''}`
                : `#${value}`}
            </span>
            <Button
              id={id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setPickerOpen(true)}
              aria-label={`${label}: ganti gambar`}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Ganti
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(null)}
              aria-label={`${label}: hapus gambar`}
            >
              <XIcon data-icon="inline-start" />
              Hapus
            </Button>
          </div>
        </div>
      )}

      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(picked) => onChange(picked.id, picked)}
        title={label}
      />
    </Field>
  );
}
