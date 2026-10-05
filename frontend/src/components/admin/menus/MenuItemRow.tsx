'use client';

import * as React from 'react';
import {
  EllipsisIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';

import type { SortableTreeHandleProps } from '@/components/admin/SortableTree';
import { dragHandleProps } from '@/components/admin/homepage/drag-handle';
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
import { usePages } from '@/lib/api/admin/pages';
import { usePublicCategoryTree } from '@/lib/api/admin/taxonomy';
import { cn } from '@/lib/cn';

import { computeHrefPreview, LINK_TYPE_LABEL, type MenuNodeData } from './tree';

export type MenuItemRowProps = {
  node: MenuNodeData;
  handleProps: SortableTreeHandleProps;
  isDragging: boolean;
  isOver: boolean;
  canAddChild: boolean;
  onToggleActive: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
};

export function MenuItemRow({
  node,
  handleProps,
  isDragging,
  isOver,
  canAddChild,
  onToggleActive,
  onEdit,
  onDelete,
  onAddChild,
}: MenuItemRowProps) {
  const { data: categoryTree } = usePublicCategoryTree();
  const { data: pages } = usePages();
  const publishedPageSlugs = React.useMemo(
    () =>
      (pages ?? []).filter((p) => p.status === 'published').map((p) => p.slug),
    [pages],
  );
  const href = computeHrefPreview(
    node.link_type,
    node.link_target,
    categoryTree ?? [],
    publishedPageSlugs,
  );

  return (
    <div
      className={cn(
        'border-line bg-card flex items-center gap-2 border p-2.5',
        isDragging && 'ring-gold ring-1',
        isOver && 'border-gold',
        !node.is_active && 'opacity-60',
      )}
    >
      <button
        type="button"
        {...dragHandleProps(handleProps)}
        className="text-muted-foreground hover:text-foreground -my-1 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:my-0 md:size-8"
        aria-label="Urutkan"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {node.label || '(tanpa label)'}
          </span>
          <Badge variant="outline" className="text-xs font-normal">
            {LINK_TYPE_LABEL[node.link_type]}
          </Badge>
          {node.open_new_tab ? (
            <ExternalLinkIcon className="text-muted-foreground size-3.5" />
          ) : null}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {href ?? 'Tautan tidak dapat diselesaikan'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
        <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center md:min-h-0 md:min-w-0">
          <Switch
            checked={node.is_active}
            onCheckedChange={onToggleActive}
            aria-label="Aktif"
          />
        </label>
        <div className="hidden items-center gap-1.5 md:flex">
          {canAddChild ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-9"
              onClick={onAddChild}
              aria-label="Tambah sub-item"
            >
              <PlusIcon className="size-4" />
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            onClick={onEdit}
            aria-label="Sunting"
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:text-destructive size-9"
            onClick={onDelete}
            aria-label="Hapus"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-11 md:hidden"
              aria-label="Aksi item menu"
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon />
              Sunting
            </DropdownMenuItem>
            {canAddChild ? (
              <DropdownMenuItem onSelect={onAddChild}>
                <PlusIcon />
                Tambah sub-item
              </DropdownMenuItem>
            ) : null}
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
