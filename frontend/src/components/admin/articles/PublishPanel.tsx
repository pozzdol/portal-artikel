'use client';

import * as React from 'react';
import { CalendarClockIcon, Trash2Icon } from 'lucide-react';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/shadcn/badge';
import { DateTimePicker } from '@/components/ui/pickers';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import type { ArticleStatus } from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';
import { cn } from '@/lib/cn';

import { isFuture, sameInstant } from './article-form';

export type PublishAction =
  | { kind: 'save'; label: string }
  | { kind: 'publish'; label: string; at: string | null | undefined }
  | { kind: 'unpublish'; label: string };

export type PublishButtons = {
  primary: PublishAction | null;
  secondary: PublishAction | null;
  unpublish: PublishAction | null;
};

/**
 * Which buttons the editor offers, from the article's current status and the
 * picked publication time (docs 07 §3.4). `publishAt` null = "now".
 */
export function publishButtons(opts: {
  status: ArticleStatus | null;
  savedPublishedAt: string | null;
  publishAt: string | null;
  canPublish: boolean;
  now?: number;
}): PublishButtons {
  const { status, savedPublishedAt, publishAt, canPublish } = opts;
  const future = isFuture(publishAt, opts.now);
  const changed = !sameInstant(publishAt, savedPublishedAt);

  if (status === 'published') {
    return {
      primary: { kind: 'save', label: 'Simpan perubahan' },
      secondary:
        canPublish && changed && publishAt
          ? {
              kind: 'publish',
              label: future ? 'Jadwalkan ulang' : 'Ubah tanggal terbit',
              at: publishAt,
            }
          : null,
      unpublish: canPublish
        ? { kind: 'unpublish', label: 'Batalkan terbit' }
        : null,
    };
  }
  if (status === 'scheduled') {
    return {
      primary: canPublish
        ? changed && publishAt
          ? {
              kind: 'publish',
              label: future ? 'Jadwalkan ulang' : 'Terbitkan',
              at: publishAt,
            }
          : { kind: 'publish', label: 'Terbitkan sekarang', at: undefined }
        : { kind: 'save', label: 'Simpan' },
      secondary: canPublish ? { kind: 'save', label: 'Simpan' } : null,
      unpublish: canPublish
        ? { kind: 'unpublish', label: 'Batalkan jadwal' }
        : null,
    };
  }
  // New, draft or archived.
  return {
    primary: canPublish
      ? {
          kind: 'publish',
          label: future ? 'Jadwalkan' : 'Terbitkan',
          at: publishAt,
        }
      : { kind: 'save', label: 'Simpan draf' },
    secondary: canPublish ? { kind: 'save', label: 'Simpan draf' } : null,
    unpublish: null,
  };
}

const WIB_LONG = "EEEE, d MMMM yyyy, HH:mm 'WIB'";

function statusLine(
  status: ArticleStatus | null,
  publishedAt: string | null,
): string {
  if (!status) return 'Belum tersimpan di server.';
  if (status === 'published' && publishedAt)
    return `Terbit ${formatWib(publishedAt, WIB_LONG)}.`;
  if (status === 'scheduled' && publishedAt)
    return `Akan terbit ${formatWib(publishedAt, WIB_LONG)}.`;
  if (status === 'archived') return 'Diarsipkan — tidak tampil di portal.';
  return 'Draf — hanya terlihat di admin.';
}

export type PublishPanelProps = {
  status: ArticleStatus | null;
  savedPublishedAt: string | null;
  publishAt: string | null;
  onPublishAtChange: (v: string | null) => void;
  buttons: PublishButtons;
  onAction: (a: PublishAction) => void;
  busy: PublishAction['kind'] | null;
  canPublish: boolean;
  readOnly?: boolean;
  /** Shown as a quiet link at the bottom (soft delete). */
  onTrash?: () => void;
  dirty: boolean;
  /**
   * Hide the primary/secondary buttons below `lg` because the editor renders
   * them in a sticky mobile action bar instead (unpublish stays in the card).
   */
  hideActionsOnMobile?: boolean;
};

export function ActionButton({
  action,
  variant,
  busy,
  disabled,
  className,
  onAction,
}: {
  action: PublishAction;
  variant: 'default' | 'outline' | 'ghost';
  busy: PublishAction['kind'] | null;
  disabled?: boolean;
  className?: string;
  onAction: (a: PublishAction) => void;
}) {
  const loading = busy === action.kind;
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled || busy !== null}
      onClick={() => onAction(action)}
    >
      {loading ? <Spinner /> : null}
      {action.label}
    </Button>
  );
}

export function PublishPanel({
  status,
  savedPublishedAt,
  publishAt,
  onPublishAtChange,
  buttons,
  onAction,
  busy,
  canPublish,
  readOnly,
  onTrash,
  dirty,
  hideActionsOnMobile,
}: PublishPanelProps) {
  const mainCls = cn('w-full', hideActionsOnMobile && 'hidden lg:inline-flex');
  const future = isFuture(publishAt);
  const pickerId = React.useId();

  return (
    <section className="border-line flex flex-col gap-4 border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold">Publikasi</h2>
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <Badge variant="outline">Draf baru</Badge>
        )}
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {statusLine(status, savedPublishedAt)}
        {dirty ? (
          <span className="text-gold-strong block">
            Ada perubahan yang belum disimpan.
          </span>
        ) : null}
      </p>

      {canPublish && !readOnly ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={pickerId}
            className="text-foreground flex items-center gap-1.5 text-sm font-medium"
          >
            <CalendarClockIcon className="text-muted-foreground size-4" />
            Tanggal terbit
          </label>
          <DateTimePicker
            id={pickerId}
            value={publishAt}
            onChange={onPublishAtChange}
            defaultTime="07:00"
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {publishAt
              ? future
                ? 'Waktu di masa depan: artikel dijadwalkan dan terbit otomatis.'
                : 'Waktu lampau: tanggal terbit dimundurkan ke waktu ini.'
              : 'Kosongkan untuk terbit saat tombol ditekan.'}
          </p>
        </div>
      ) : null}

      {!canPublish && !readOnly ? (
        <p className="text-muted-foreground text-xs">
          Anda bisa menyimpan draf; penerbitan dilakukan oleh admin yang
          berwenang.
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-col gap-2">
          {buttons.primary ? (
            <ActionButton
              action={buttons.primary}
              variant="default"
              busy={busy}
              onAction={onAction}
              className={mainCls}
            />
          ) : null}
          {buttons.secondary ? (
            <ActionButton
              action={buttons.secondary}
              variant="outline"
              busy={busy}
              onAction={onAction}
              className={mainCls}
            />
          ) : null}
          {buttons.unpublish ? (
            <ActionButton
              action={buttons.unpublish}
              variant="ghost"
              busy={busy}
              onAction={onAction}
              className="text-muted-foreground w-full"
            />
          ) : null}
        </div>
      ) : null}

      {onTrash ? (
        <button
          type="button"
          onClick={onTrash}
          disabled={busy !== null}
          className={cn(
            'text-muted-foreground hover:text-destructive inline-flex w-fit items-center gap-1.5 text-xs underline-offset-2 hover:underline',
          )}
        >
          <Trash2Icon className="size-3.5" />
          Pindahkan ke Sampah
        </button>
      ) : null}
    </section>
  );
}
