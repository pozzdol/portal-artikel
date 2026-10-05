'use client';

import {
  CircleAlertIcon,
  CopyIcon,
  EllipsisIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';

import {
  SortableList,
  type SortableHandleProps,
} from '@/components/admin/SortableList';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { Switch } from '@/components/ui/shadcn/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import type { HomepageSection } from '@/lib/api/admin/types';
import { cn } from '@/lib/cn';

import { dragHandleProps } from './drag-handle';

import { SectionThumbnail } from './section-meta';
import { summarizeConfig } from './schema-form';

export type SectionVisibility =
  'visible' | 'inactive' | 'invalid' | 'empty' | 'unknown';

/** Why a section is (not) on the public homepage. */
export function sectionVisibility(
  s: HomepageSection,
  publicIds: Set<number> | undefined,
): SectionVisibility {
  if (!s.config_valid) return 'invalid';
  if (!s.is_active) return 'inactive';
  if (!publicIds) return 'unknown';
  return publicIds.has(s.id) ? 'visible' : 'empty';
}

export type SectionListProps = {
  sections: HomepageSection[];
  publicIds: Set<number> | undefined;
  /** Optimistic is_active while the toggle request is in flight. */
  pendingActive: Map<number, boolean>;
  /** Friendly name per section type code (from the section type registry). */
  typeLabels?: Map<string, string>;
  disabled?: boolean;
  onReorder: (next: HomepageSection[]) => void;
  onToggleActive: (s: HomepageSection, active: boolean) => void;
  onEdit: (s: HomepageSection) => void;
  onDuplicate: (s: HomepageSection) => void;
  onDelete: (s: HomepageSection) => void;
};

/** The homepage running order: drag to reorder, toggle, edit, duplicate, delete. */
export function SectionList({
  sections,
  publicIds,
  pendingActive,
  typeLabels,
  disabled,
  onReorder,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
}: SectionListProps) {
  return (
    <section className="border-line border" aria-label="Urutan section beranda">
      <SortableList
        items={sections}
        getId={(s) => s.id}
        onReorder={onReorder}
        disabled={disabled}
        className="gap-0"
        renderItem={(s, { handleProps, isDragging }) => {
          const active = pendingActive.get(s.id) ?? s.is_active;
          return (
            <SectionRow
              section={{ ...s, is_active: active }}
              typeLabel={typeLabels?.get(s.type) ?? s.type}
              position={sections.indexOf(s) + 1}
              visibility={sectionVisibility(
                { ...s, is_active: active },
                publicIds,
              )}
              handleProps={handleProps}
              isDragging={isDragging}
              toggling={pendingActive.has(s.id)}
              disabled={disabled}
              onToggleActive={(v) => onToggleActive(s, v)}
              onEdit={() => onEdit(s)}
              onDuplicate={() => onDuplicate(s)}
              onDelete={() => onDelete(s)}
            />
          );
        }}
      />
    </section>
  );
}

function SectionRow({
  section: s,
  typeLabel,
  position,
  visibility,
  handleProps,
  isDragging,
  toggling,
  disabled,
  onToggleActive,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  section: HomepageSection;
  typeLabel: string;
  position: number;
  visibility: SectionVisibility;
  handleProps: SortableHandleProps;
  isDragging: boolean;
  toggling: boolean;
  disabled?: boolean;
  onToggleActive: (v: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const summary = summarizeConfig(s.type, s.config ?? {});
  const switchId = `active-${s.id}`;
  const dim = visibility === 'inactive';

  return (
    <div
      data-section-id={s.id}
      className={cn(
        'border-line bg-background grid grid-cols-[auto_1fr_auto] items-center gap-x-2 border-b px-1 py-2.5 sm:grid-cols-[auto_auto_auto_1fr_auto] sm:gap-x-3 sm:px-3 sm:py-3',
        isDragging && 'border-gold relative border shadow-lg',
      )}
    >
      <button
        type="button"
        {...dragHandleProps(handleProps)}
        disabled={disabled}
        aria-label={`Pindahkan ${s.label}`}
        className="text-meta hover:text-foreground focus-visible:ring-gold flex min-w-11 cursor-grab touch-none items-center justify-center self-stretch outline-none focus-visible:ring-2 active:cursor-grabbing disabled:cursor-default sm:min-w-8"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <span
        className={cn(
          'text-meta hidden w-6 text-right text-sm font-medium tabular-nums sm:block',
          dim && 'opacity-50',
        )}
        aria-hidden="true"
      >
        {position}
      </span>

      <SectionThumbnail
        type={s.type}
        className={cn('hidden w-16 sm:block', dim && 'opacity-40')}
      />

      <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1">
        <div className="flex min-w-0 items-center gap-x-2">
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'hover:text-gold-strong min-h-11 min-w-0 flex-1 truncate text-left font-medium sm:min-h-0 sm:flex-none',
              dim && 'text-meta',
            )}
          >
            {s.label}
          </button>
          <Badge
            variant="outline"
            title={s.type}
            className="text-meta hidden text-xs font-normal sm:inline-flex"
          >
            {typeLabel}
          </Badge>
        </div>
        <p
          className="text-meta -mt-2 truncate text-xs sm:hidden"
          title={s.type}
        >
          {typeLabel}
        </p>
        {summary.length ? (
          <ul className="text-meta hidden flex-wrap gap-x-3 gap-y-0.5 text-xs sm:flex">
            {summary.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
        <VisibilityNote visibility={visibility} />
      </div>

      <div className="flex items-center justify-end gap-0 sm:gap-2">
        <label
          htmlFor={switchId}
          className={cn(
            'flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 text-xs sm:min-h-0 sm:min-w-0 sm:justify-start sm:pr-1',
            s.is_active ? 'text-foreground' : 'text-meta',
          )}
        >
          <Switch
            id={switchId}
            checked={s.is_active}
            disabled={disabled || toggling}
            onCheckedChange={onToggleActive}
            aria-label={`${s.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${s.label}`}
          />
          <span className="sr-only sm:not-sr-only sm:w-14" aria-hidden="true">
            {s.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="hidden sm:inline-flex"
        >
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-11 sm:size-8"
              aria-label={`Aksi lain untuk ${s.label}`}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit} className="sm:hidden">
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <CopyIcon />
              Duplikat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function VisibilityNote({ visibility }: { visibility: SectionVisibility }) {
  if (visibility === 'invalid') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-destructive flex w-fit items-center gap-1.5 text-xs font-medium">
            <CircleAlertIcon className="size-3.5" />
            Config tidak valid, tidak tampil
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Buka Edit, periksa isian, lalu simpan ulang.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (visibility === 'empty') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-gold-strong flex w-fit items-center gap-1.5 text-xs font-medium">
            <EyeOffIcon className="size-3.5" />
            Tidak akan tampil: data kosong
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Belum ada konten yang cocok dengan pengaturan section ini.
        </TooltipContent>
      </Tooltip>
    );
  }
  return null;
}
