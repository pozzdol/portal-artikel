'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import {
  useDeleteArticle,
  usePreviewToken,
  usePublishArticle,
  useRestoreArticle,
  useUnpublishArticle,
} from '@/lib/api/admin/articles';
import type { AdminArticleItem } from '@/lib/api/admin/types';
import { formatWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';

type Target = Pick<AdminArticleItem, 'id' | 'title' | 'status' | 'url'>;

/**
 * Opens a tab synchronously (inside the click) so popup blockers allow it,
 * then points it at `url` once known.
 */
function openPending(): Window | null {
  const w = window.open('about:blank', '_blank');
  if (w) w.opener = null;
  return w;
}

/** Status actions shared by the list rows and the editor. */
export function useArticleActions() {
  const publish = usePublishArticle();
  const unpublish = useUnpublishArticle();
  const remove = useDeleteArticle();
  const restore = useRestoreArticle();
  const preview = usePreviewToken();

  /** Published → public URL; anything else → fresh preview token URL. */
  const view = useCallback(
    async (a: Target) => {
      if (a.status === 'published') {
        window.open(a.url, '_blank', 'noopener');
        return;
      }
      const w = openPending();
      try {
        const t = await preview.mutateAsync(a.id);
        if (w) w.location.href = t.url;
        else window.open(t.url, '_blank', 'noopener');
      } catch (err) {
        w?.close();
        toastApiError(err);
      }
    },
    [preview],
  );

  const publishNow = useCallback(
    async (a: Target, publishedAt?: string | null) => {
      try {
        const d = await publish.mutateAsync({
          id: a.id,
          published_at: publishedAt ?? undefined,
        });
        if (d.status === 'scheduled' && d.published_at) {
          toast.success('Artikel dijadwalkan.', {
            description: `Terbit ${formatWib(d.published_at, "d MMM yyyy, HH:mm 'WIB'")}.`,
          });
        } else {
          toast.success('Artikel diterbitkan.');
        }
        return d;
      } catch (err) {
        toastApiError(err);
        return null;
      }
    },
    [publish],
  );

  const unpublishNow = useCallback(
    async (a: Target) => {
      try {
        const d = await unpublish.mutateAsync(a.id);
        toast.success(
          a.status === 'scheduled'
            ? 'Jadwal terbit dibatalkan. Artikel kembali menjadi draf.'
            : 'Artikel batal terbit dan kembali menjadi draf.',
        );
        return d;
      } catch (err) {
        toastApiError(err);
        return null;
      }
    },
    [unpublish],
  );

  const trash = useCallback(
    async (a: Target) => {
      try {
        await remove.mutateAsync(a.id);
        toast.success('Artikel dipindahkan ke Sampah.', {
          action: {
            label: 'Urungkan',
            onClick: () => {
              restore.mutate(a.id, {
                onSuccess: () => toast.success('Artikel dipulihkan.'),
                onError: (err) => toastApiError(err),
              });
            },
          },
        });
        return true;
      } catch (err) {
        toastApiError(err);
        return false;
      }
    },
    [remove, restore],
  );

  const untrash = useCallback(
    async (a: Target) => {
      try {
        await restore.mutateAsync(a.id);
        toast.success('Artikel dipulihkan.');
        return true;
      } catch (err) {
        toastApiError(err);
        return false;
      }
    },
    [restore],
  );

  return {
    view,
    publishNow,
    unpublishNow,
    trash,
    untrash,
    pending: {
      publish: publish.isPending,
      unpublish: unpublish.isPending,
      remove: remove.isPending,
      restore: restore.isPending,
      preview: preview.isPending,
    },
  };
}
