'use client';

import { useMemo, useState } from 'react';
import {
  FolderTreeIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import {
  useCategoryTree,
  useDeleteCategory,
  useReorderCategories,
} from '@/lib/api/admin/taxonomy';
import type {
  CategoryReorderItem,
  CategoryTreeNode,
} from '@/lib/api/admin/types';
import { isApiClientError } from '@/lib/api/client';
import { toastApiError } from '@/lib/forms/serverErrors';
import { cn } from '@/lib/cn';

import {
  SortableTree,
  type SortableTreeHandleProps,
} from '@/components/admin/SortableTree';

import { CategoryFormDialog } from './CategoryFormDialog';

/** Full-set reorder payload for the current (already valid) nested tree. */
function buildReorderItems(tree: CategoryTreeNode[]): CategoryReorderItem[] {
  const items: CategoryReorderItem[] = [];
  const walk = (nodes: CategoryTreeNode[], parentId: number | null) => {
    nodes.forEach((node, idx) => {
      items.push({
        id: node.id,
        parent_id: parentId,
        sort_order: (idx + 1) * 10,
      });
      if (node.children.length > 0) walk(node.children, node.id);
    });
  };
  walk(tree, null);
  return items;
}

/** A node that itself has children cannot become someone else's child (3rd level). */
function hasInvalidNesting(tree: CategoryTreeNode[]): boolean {
  return tree.some((root) =>
    root.children.some((child) => child.children.length > 0),
  );
}

/** Root categories only (children stripped), self excluded — valid "induk" choices. */
function parentOptionsFor(
  tree: CategoryTreeNode[],
  excludeId?: number,
): CategoryTreeNode[] {
  return tree
    .filter((node) => node.id !== excludeId)
    .map((node) => ({ ...node, children: [] }));
}

export function CategoriesPage() {
  const { data: tree, isLoading, isError, error, refetch } = useCategoryTree();
  const reorder = useReorderCategories();
  const del = useDeleteCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTreeNode | null>(null);
  const [initialParentId, setInitialParentId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<CategoryTreeNode | null>(null);

  const parentOptions = useMemo(
    () => parentOptionsFor(tree ?? [], editing?.id),
    [tree, editing],
  );

  function openCreate(parentId: number | null = null) {
    setEditing(null);
    setInitialParentId(parentId);
    setFormOpen(true);
  }

  function openEdit(category: CategoryTreeNode) {
    setEditing(category);
    setInitialParentId(null);
    setFormOpen(true);
  }

  function handleReorder(nextTree: CategoryTreeNode[]) {
    if (hasInvalidNesting(nextTree)) {
      toast.error(
        'Kategori dengan sub-kategori tidak bisa dipindah menjadi anak.',
      );
      return;
    }
    reorder.mutate(buildReorderItems(nextTree), {
      onError: (err) => toastApiError(err),
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Kategori "${deleting.name}" dihapus.`);
        setDeleting(null);
      },
      onError: (err) => {
        setDeleting(null);
        if (isApiClientError(err) && err.status === 409) {
          toast.error(err.message);
          return;
        }
        toastApiError(err);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kategori"
        description="Pohon kategori 2 level. Seret untuk mengubah urutan atau induk."
        actions={
          <Button variant="gold" onClick={() => openCreate(null)}>
            <PlusIcon data-icon="inline-start" />
            Tambah kategori
          </Button>
        }
      />

      {isLoading ? (
        <ListPageSkeleton rows={6} columns={3} />
      ) : isError ? (
        <EmptyState
          icon={FolderTreeIcon}
          title="Gagal memuat kategori"
          description={
            isApiClientError(error) ? error.message : 'Terjadi kesalahan.'
          }
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : !tree || tree.length === 0 ? (
        <EmptyState
          icon={FolderTreeIcon}
          title="Belum ada kategori"
          description="Buat kategori pertama untuk mengelompokkan artikel."
          action={
            <Button variant="gold" onClick={() => openCreate(null)}>
              <PlusIcon data-icon="inline-start" />
              Tambah kategori
            </Button>
          }
        />
      ) : (
        <SortableTree<CategoryTreeNode>
          items={tree}
          maxDepth={2}
          onChange={handleReorder}
          disabled={reorder.isPending}
          renderItem={(category, { depth, handleProps, isDragging }) => (
            <CategoryRow
              category={category}
              depth={depth}
              isDragging={isDragging}
              handleProps={handleProps}
              onEdit={() => openEdit(category)}
              onAddChild={
                depth === 0 ? () => openCreate(category.id) : undefined
              }
              onDelete={() => setDeleting(category)}
            />
          )}
        />
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        parentOptions={parentOptions}
        initialParentId={initialParentId}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Hapus kategori "${deleting?.name}"?`}
        description="Kategori yang masih punya artikel atau sub-kategori tidak bisa dihapus."
        confirmLabel="Hapus kategori"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryRow({
  category,
  depth,
  isDragging,
  handleProps,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: CategoryTreeNode;
  depth: number;
  isDragging: boolean;
  handleProps: SortableTreeHandleProps;
  onEdit: () => void;
  onAddChild?: () => void;
  onDelete: () => void;
}) {
  // Renamed on destructure: the lint rule's ref-access heuristic matches on a
  // literal `.ref` property read, which this drag handle callback ref is not.
  const { ref: setHandleRef, attributes, listeners } = handleProps;
  return (
    <div
      data-testid={`category-row-${category.id}`}
      className={cn(
        'border-line bg-background flex items-center gap-2 border px-3 py-2.5',
        isDragging && 'shadow-md',
      )}
    >
      <button
        type="button"
        ref={setHandleRef}
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground -ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-label={`Urutkan ${category.name}`}
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            'truncate font-medium',
            depth === 0 ? 'text-[15px]' : 'text-sm',
          )}
        >
          {category.name}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          /{category.slug}
        </span>
        <StatusBadge status={category.is_active ? 'active' : 'inactive'} />
        <Badge variant="outline" className="text-muted-foreground shrink-0">
          {category.article_count} artikel
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onAddChild ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAddChild}>
            <PlusIcon data-icon="inline-start" />
            Subkategori
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`Sunting ${category.name}`}
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Hapus ${category.name}`}
        >
          <Trash2Icon className="text-destructive" />
        </Button>
      </div>
    </div>
  );
}
