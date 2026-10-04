'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import type { AdminArticleItem } from '@/lib/api/admin/types';

import { canEditArticle, type ArticlePerms } from './article-form';
import { useArticleActions } from './useArticleActions';

type Confirm = 'delete' | 'unpublish' | null;

export function ArticleRowActions({
  article: a,
  trashed,
  perms,
  meId,
}: {
  article: AdminArticleItem;
  trashed: boolean;
  perms: ArticlePerms;
  meId: number | null;
}) {
  const actions = useArticleActions();
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const editable = canEditArticle(perms, meId, a.created_by);
  const live = a.status === 'published' || a.status === 'scheduled';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Aksi untuk ${a.title}`}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {trashed ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/articles/${a.id}`}>
                  <EyeIcon />
                  Buka
                </Link>
              </DropdownMenuItem>
              {perms.remove ? (
                <DropdownMenuItem onSelect={() => void actions.untrash(a)}>
                  <RotateCcwIcon />
                  Pulihkan
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/articles/${a.id}`}>
                  <PencilIcon />
                  {editable ? 'Edit' : 'Buka'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void actions.view(a)}>
                <ExternalLinkIcon />
                {a.status === 'published' ? 'Lihat' : 'Pratinjau'}
              </DropdownMenuItem>
              {perms.publish ? (
                <>
                  <DropdownMenuSeparator />
                  {a.status !== 'published' ? (
                    <DropdownMenuItem
                      onSelect={() => void actions.publishNow(a)}
                    >
                      <SendIcon />
                      {a.status === 'scheduled'
                        ? 'Terbitkan sekarang'
                        : 'Terbitkan'}
                    </DropdownMenuItem>
                  ) : null}
                  {live ? (
                    <DropdownMenuItem onSelect={() => setConfirm('unpublish')}>
                      <Undo2Icon />
                      Batalkan terbit
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              {perms.remove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirm('delete')}
                  >
                    <Trash2Icon />
                    Hapus
                  </DropdownMenuItem>
                </>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Pindahkan artikel ke Sampah?"
        description={
          <>
            “{a.title}” tidak lagi tampil di portal. Anda bisa memulihkannya
            dari tab Sampah.
          </>
        }
        confirmLabel="Hapus artikel"
        destructive
        loading={actions.pending.remove}
        onConfirm={async () => {
          await actions.trash(a);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'unpublish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          a.status === 'scheduled'
            ? 'Batalkan jadwal terbit?'
            : 'Batalkan terbit artikel?'
        }
        description={
          <>“{a.title}” akan kembali menjadi draf dan tidak tampil di portal.</>
        }
        confirmLabel="Batalkan terbit"
        loading={actions.pending.unpublish}
        onConfirm={async () => {
          await actions.unpublishNow(a);
          setConfirm(null);
        }}
      />
    </>
  );
}
