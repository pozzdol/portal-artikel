'use client';

import { useState } from 'react';
import {
  GitMergeIcon,
  PencilIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  DataTable,
  createDataTableColumnHelper,
} from '@/components/admin/DataTable';
import { DataTableToolbar } from '@/components/admin/DataTableToolbar';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { useDeleteTag, useTags } from '@/lib/api/admin/taxonomy';
import type { Tag } from '@/lib/api/admin/types';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useListParams } from '@/lib/hooks/useListParams';

import { TagFormDialog } from './TagFormDialog';
import { TagMergeDialog } from './TagMergeDialog';

const PER_PAGE = 20;
const col = createDataTableColumnHelper<Tag>();

const columns = [
  col.accessor('name', {
    header: 'Nama',
    cell: (ctx) => <span className="font-medium">{ctx.getValue()}</span>,
  }),
  col.accessor('slug', {
    header: 'Slug',
    cell: (ctx) => (
      <span className="text-muted-foreground font-mono text-xs">
        /{ctx.getValue()}
      </span>
    ),
    meta: { hideBelow: 'sm' },
  }),
  col.accessor('article_count', {
    header: 'Artikel',
    cell: (ctx) => (
      <Badge variant="outline" className="text-muted-foreground">
        {ctx.getValue()}
      </Badge>
    ),
    meta: { align: 'right' },
  }),
];

export function TagsPage() {
  const { params, set } = useListParams({ q: '', page: 1 });
  const { data, isLoading } = useTags({
    q: params.q || undefined,
    page: params.page,
    per_page: PER_PAGE,
  });

  const del = useDeleteTag();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [merging, setMerging] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(tag: Tag) {
    setEditing(tag);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Tag "${deleting.name}" dihapus.`);
        setDeleting(null);
      },
      onError: (err) => {
        setDeleting(null);
        toastApiError(err);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tag"
        description="Tag bebas untuk menandai artikel lintas kategori."
        actions={
          <Button variant="gold" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Tambah tag
          </Button>
        }
      />

      <DataTable<Tag>
        columns={columns}
        data={data?.items ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        page={params.page}
        onPageChange={(page) => set({ page }, { resetPage: false })}
        getRowId={(row) => row.id}
        toolbar={
          <DataTableToolbar
            search={{
              value: params.q,
              onChange: (q) => set({ q }),
              placeholder: 'Cari tag…',
            }}
          />
        }
        empty={
          <div className="flex flex-col items-center gap-2 py-6">
            <TagsIcon className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">
              {params.q ? 'Tidak ada tag yang cocok.' : 'Belum ada tag.'}
            </p>
          </div>
        }
        rowActions={(tag) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setMerging(tag)}
              aria-label={`Gabung tag ${tag.name}`}
              title="Gabung ke tag lain"
            >
              <GitMergeIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => openEdit(tag)}
              aria-label={`Sunting tag ${tag.name}`}
            >
              <PencilIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleting(tag)}
              aria-label={`Hapus tag ${tag.name}`}
            >
              <Trash2Icon className="text-destructive" />
            </Button>
          </div>
        )}
      />

      <TagFormDialog open={formOpen} onOpenChange={setFormOpen} tag={editing} />
      <TagMergeDialog
        open={!!merging}
        onOpenChange={(open) => !open && setMerging(null)}
        tag={merging}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Hapus tag "${deleting?.name}"?`}
        description={
          deleting && deleting.article_count > 0
            ? `Tag ini masih dipakai ${deleting.article_count} artikel. Tautan tag pada artikel tersebut akan hilang.`
            : 'Tindakan ini tidak bisa dibatalkan.'
        }
        confirmLabel="Hapus tag"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
