'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { useRef } from 'react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Input } from '@/components/ui/shadcn/input';

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        {/* Darker than the shadcn default (bg-black/10): matches the
            original overlay's ink/60 scrim. */}
        <DialogOverlay className="bg-ink/60 z-[60] supports-backdrop-filter:backdrop-blur-none" />
        <DialogPrimitive.Content
          aria-label="Pencarian"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="border-line bg-paper fixed inset-x-4 top-20 z-[60] w-auto border p-5 outline-none sm:inset-x-auto sm:top-24 sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2 sm:p-6"
        >
          <DialogTitle className="sr-only">Pencarian</DialogTitle>
          <form action="/cari" className="flex items-center gap-3">
            <Input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              name="q"
              placeholder="Cari artikel, tokoh, agenda…"
              className="text-body placeholder:text-ghost border-line focus:border-gold focus-visible:border-gold h-auto flex-1 rounded-none border-x-0 border-t-0 border-b bg-transparent px-0 py-2 text-base shadow-none focus:outline-none focus-visible:ring-0 sm:text-[17px] dark:bg-transparent"
            />
            <Button
              type="submit"
              variant="outline"
              className="border-ink h-11 min-w-[72px] rounded-[8px] bg-transparent px-4 text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
            >
              Cari
            </Button>
          </form>
          <Button
            type="button"
            variant="link"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="text-meta hover:border-line mt-4 h-auto min-h-11 border-b border-transparent p-0 text-[13px] font-normal no-underline hover:no-underline"
          >
            Tutup
          </Button>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
