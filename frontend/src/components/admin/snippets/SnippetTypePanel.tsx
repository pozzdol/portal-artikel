'use client';

import * as React from 'react';
import { MessageSquareQuoteIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { SortableList } from '@/components/admin/SortableList';
import { Button } from '@/components/ui/shadcn/button';
import {
  useDeleteSnippet,
  useReorderSnippets,
  useSnippets,
} from '@/lib/api/admin/snippets';
import { toastApiError } from '@/lib/forms/serverErrors';
import type { AdminSnippet, SnippetType } from '@/lib/api/admin/types';

import {
  SNIPPET_TYPE_HINT,
  SNIPPET_TYPE_LABEL,
  snippetPreviewBody,
  snippetPreviewTitle,
} from './helpers';
import { SnippetFormDialog } from './SnippetFormDialog';
import { SnippetRow } from './SnippetRow';

type DialogState = { mode: 'create' } | { mode: 'edit'; snippet: AdminSnippet };

export function SnippetTypePanel({ type }: { type: SnippetType }) {
  const { data, isLoading } = useSnippets(type);
  const reorder = useReorderSnippets(type);
  const deleteSnippet = useDeleteSnippet();
  const [dialogState, setDialogState] = React.useState<DialogState | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = React.useState<AdminSnippet | null>(
    null,
  );

  const items = data ?? [];
  const label = SNIPPET_TYPE_LABEL[type];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground max-w-prose text-sm">
          {SNIPPET_TYPE_HINT[type]}
        </p>
        <Button size="sm" onClick={() => setDialogState({ mode: 'create' })}>
          <PlusIcon /> Tambah {label}
        </Button>
      </div>

      {isLoading ? (
        <ListPageSkeleton rows={3} columns={1} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuoteIcon}
          title={`Belum ada ${label}`}
          description="Tambahkan yang pertama untuk menampilkannya di beranda."
          action={
            <Button
              size="sm"
              onClick={() => setDialogState({ mode: 'create' })}
            >
              <PlusIcon /> Tambah {label}
            </Button>
          }
        />
      ) : (
        <SortableList
          items={items}
          getId={(s) => s.id}
          onReorder={(ordered) => reorder.mutate(ordered)}
          renderItem={(snippet, { handleProps, isDragging }) => (
            <SnippetRow
              snippet={snippet}
              handleProps={handleProps}
              isDragging={isDragging}
              onEdit={() => setDialogState({ mode: 'edit', snippet })}
              onDelete={() => setPendingDelete(snippet)}
            />
          )}
        />
      )}

      {dialogState ? (
        <SnippetFormDialog
          key={dialogState.mode === 'edit' ? dialogState.snippet.id : 'new'}
          open
          onOpenChange={(next) => {
            if (!next) setDialogState(null);
          }}
          type={type}
          snippet={dialogState.mode === 'edit' ? dialogState.snippet : null}
          existing={items}
        />
      ) : null}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={`Hapus ${label}?`}
        description={
          pendingDelete
            ? `"${snippetPreviewTitle(pendingDelete) ?? snippetPreviewBody(pendingDelete)}" akan dihapus permanen.`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        loading={deleteSnippet.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteSnippet.mutateAsync(pendingDelete.id);
            toast.success('Snippet dihapus.');
            setPendingDelete(null);
          } catch (err) {
            toastApiError(err);
          }
        }}
      />
    </div>
  );
}
