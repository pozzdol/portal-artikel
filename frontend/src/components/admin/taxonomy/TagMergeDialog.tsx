'use client';

import { useState } from 'react';
import { GitMergeIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Combobox } from '@/components/admin/Combobox';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useMergeTags, useTags } from '@/lib/api/admin/taxonomy';
import type { Tag } from '@/lib/api/admin/types';
import { isApiClientError } from '@/lib/api/client';
import { toastApiError } from '@/lib/forms/serverErrors';
import { useDebounce } from '@/lib/hooks/useDebounce';

export type TagMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tag being merged away (deleted once its articles move to the target). */
  tag: Tag | null;
};

/** Moves every article from `tag` into a chosen target tag, then deletes `tag`. */
export function TagMergeDialog({
  open,
  onOpenChange,
  tag,
}: TagMergeDialogProps) {
  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState<number | null>(null);
  const debounced = useDebounce(query, 300);
  const { data, isLoading } = useTags(
    { q: debounced || undefined, per_page: 20 },
    { enabled: open },
  );
  const merge = useMergeTags();

  const items = (data?.items ?? []).filter((t) => t.id !== tag?.id);
  const target = items.find((t) => t.id === targetId) ?? null;

  function handleOpenChange(next: boolean) {
    if (merge.isPending) return;
    if (!next) {
      setQuery('');
      setTargetId(null);
    }
    onOpenChange(next);
  }

  function confirm() {
    if (!tag || !targetId) return;
    merge.mutate(
      { id: tag.id, intoId: targetId },
      {
        onSuccess: (into) => {
          toast.success(`Tag "${tag.name}" digabung ke "${into.name}".`);
          handleOpenChange(false);
        },
        onError: (err) => {
          if (isApiClientError(err) && err.status === 409) {
            toast.error(err.message);
            return;
          }
          toastApiError(err);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Gabung tag</DialogTitle>
          <DialogDescription>
            Semua artikel bertag &ldquo;{tag?.name}&rdquo; dipindahkan ke tag
            tujuan, lalu &ldquo;{tag?.name}&rdquo; dihapus. Tindakan ini tidak
            bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="merge-target">Gabung ke</FieldLabel>
          <Combobox<Tag>
            id="merge-target"
            items={items}
            value={targetId}
            onChange={(v) => setTargetId(v as number | null)}
            getKey={(t) => t.id}
            getLabel={(t) => t.name}
            placeholder="Pilih tag tujuan…"
            emptyText="Tag tidak ditemukan."
            onSearch={setQuery}
            isLoading={isLoading}
            disabled={merge.isPending}
          />
          <FieldDescription>
            {target
              ? `${target.article_count} artikel saat ini di tag tujuan.`
              : null}
          </FieldDescription>
        </Field>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            disabled={merge.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!targetId || merge.isPending}
            onClick={confirm}
          >
            {merge.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <GitMergeIcon data-icon="inline-start" />
            )}
            Gabung tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
