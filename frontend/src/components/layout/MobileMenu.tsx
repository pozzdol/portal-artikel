'use client';

import Link from 'next/link';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { MenuItem } from '@/lib/api/types';

import { Button } from '@/components/ui/shadcn/button';
import { Sheet, SheetTitle } from '@/components/ui/shadcn/sheet';

export function MobileMenu({
  open,
  onClose,
  items,
  showLoginButton,
  loginLabel,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  showLoginButton?: boolean;
  loginLabel?: string;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetPrimitive.Portal>
        {/* Darker than the shadcn default (bg-black/10): matches the
            original overlay's ink/50 scrim. */}
        <SheetPrimitive.Overlay className="bg-ink/50 fixed inset-0 z-[60] xl:hidden" />
        <SheetPrimitive.Content
          aria-label="Menu navigasi"
          data-slot="sheet-content"
          data-side="right"
          className="border-line bg-paper data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-10 fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[320px] flex-col gap-1 overflow-y-auto border-l p-6 shadow-none transition duration-200 ease-in-out xl:hidden"
        >
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label="Tutup menu"
            className="border-line mb-6 h-9 w-9 self-end rounded-[8px] bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </Button>
          <nav
            aria-label="Navigasi utama (mobile)"
            className="flex flex-col gap-1"
          >
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                target={item.open_new_tab ? '_blank' : undefined}
                rel={item.open_new_tab ? 'noopener noreferrer' : undefined}
                className="border-line border-b py-3 text-[16px] font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {showLoginButton ? (
            <Button
              asChild
              variant="outline"
              className="border-ink mt-4 h-auto rounded-[8px] bg-transparent px-[18px] py-[9px] text-center text-[13px] font-medium shadow-none hover:bg-transparent sm:hidden dark:bg-transparent dark:hover:bg-transparent"
            >
              <Link href="/admin/login" onClick={onClose}>
                {loginLabel || 'Login Admin'}
              </Link>
            </Button>
          ) : null}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
