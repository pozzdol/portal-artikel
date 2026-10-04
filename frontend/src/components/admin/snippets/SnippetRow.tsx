'use client';

import { GripVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react';

import type { SortableHandleProps } from '@/components/admin/SortableList';
import { dragHandleProps } from '@/components/admin/homepage/drag-handle';
import { Button } from '@/components/ui/shadcn/button';
import { Switch } from '@/components/ui/shadcn/switch';
import { cn } from '@/lib/cn';
import { useUpdateSnippet } from '@/lib/api/admin/snippets';
import { toastApiError } from '@/lib/forms/serverErrors';
import type { AdminSnippet } from '@/lib/api/admin/types';

import {
  snippetPeriodLabel,
  snippetPreviewBody,
  snippetPreviewTitle,
  snippetToInput,
} from './helpers';

export type SnippetRowProps = {
  snippet: AdminSnippet;
  handleProps: SortableHandleProps;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function SnippetRow({
  snippet,
  handleProps,
  isDragging,
  onEdit,
  onDelete,
}: SnippetRowProps) {
  const update = useUpdateSnippet();
  const title = snippetPreviewTitle(snippet);
  const period = snippetPeriodLabel(snippet);

  function toggleActive(next: boolean) {
    update.mutate(
      {
        id: snippet.id,
        input: { ...snippetToInput(snippet), is_active: next },
      },
      { onError: (err) => toastApiError(err) },
    );
  }

  return (
    <div
      className={cn(
        'border-line bg-card flex items-start gap-3 border p-3',
        isDragging && 'ring-gold ring-1',
      )}
    >
      <button
        type="button"
        {...dragHandleProps(handleProps)}
        className="text-muted-foreground hover:text-foreground mt-1 shrink-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Urutkan"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-foreground truncate text-sm font-medium">
            {title}
          </p>
        ) : null}
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {snippetPreviewBody(snippet)}
        </p>
        {period ? (
          <p className="text-muted-foreground mt-1 text-xs">{period}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={snippet.is_active}
          onCheckedChange={toggleActive}
          aria-label="Aktif"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onEdit}
          aria-label="Sunting"
        >
          <PencilIcon className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          aria-label="Hapus"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
