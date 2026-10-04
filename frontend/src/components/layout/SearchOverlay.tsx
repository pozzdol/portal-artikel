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
          className="border-line bg-paper fixed top-24 left-1/2 z-[60] w-full max-w-[560px] -translate-x-1/2 border p-6 outline-none"
        >
          <DialogTitle className="sr-only">Pencarian</DialogTitle>
          <form action="/cari" className="flex items-center gap-3">
            <Input
              ref={inputRef}
              type="search"
              name="q"
              placeholder="Cari artikel, tokoh, agenda…"
              className="text-body placeholder:text-ghost border-line focus:border-gold focus-visible:border-gold h-auto flex-1 rounded-none border-x-0 border-t-0 border-b bg-transparent px-0 py-2 text-[17px] shadow-none focus:outline-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button
              type="submit"
              variant="outline"
              className="border-ink h-auto rounded-[8px] bg-transparent px-4 py-2 text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
            >
              Cari
            </Button>
          </form>
          <Button
            type="button"
            variant="link"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="text-meta hover:border-line mt-4 h-auto border-b border-transparent p-0 text-[13px] font-normal no-underline hover:no-underline"
          >
            Tutup
          </Button>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
