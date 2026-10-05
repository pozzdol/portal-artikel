'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { MenuItem } from '@/lib/api/types';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Sheet, SheetTitle } from '@/components/ui/shadcn/sheet';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileMenu({
  open,
  onClose,
  items,
  showLoginButton,
  loginLabel,
  showSearch,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  showLoginButton?: boolean;
  loginLabel?: string;
  showSearch?: boolean;
}) {
  const pathname = usePathname();
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
        <SheetPrimitive.Overlay className="bg-ink/50 fixed inset-0 z-[60] lg:hidden" />
        <SheetPrimitive.Content
          aria-label="Menu navigasi"
          data-slot="sheet-content"
          data-side="right"
          className="border-line bg-paper data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-10 fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[320px] flex-col gap-1 overflow-y-auto border-l p-6 shadow-none transition duration-200 ease-in-out lg:hidden"
        >
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label="Tutup menu"
            className="border-line mb-4 size-11 self-end rounded-[8px] bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
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
          {showSearch ? (
            <form action="/cari" className="mb-4 flex items-center gap-2">
              <Input
                type="search"
                name="q"
                enterKeyHint="search"
                aria-label="Kata kunci pencarian"
                placeholder="Cari artikel…"
                className="border-line h-11 flex-1 rounded-[8px] bg-transparent text-base shadow-none dark:bg-transparent"
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                aria-label="Cari"
                className="border-line size-11 rounded-[8px] bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
              >
                <Search className="size-4" />
              </Button>
            </form>
          ) : null}
          <nav
            aria-label="Navigasi utama (mobile)"
            className="flex flex-col gap-1"
          >
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  target={item.open_new_tab ? '_blank' : undefined}
                  rel={item.open_new_tab ? 'noopener noreferrer' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'border-line flex min-h-12 items-center border-b py-3 text-[16px] font-medium',
                    active && 'border-l-gold border-l-2 pl-3',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {showLoginButton ? (
            <Button
              asChild
              variant="outline"
              className="border-ink mt-4 h-11 rounded-[8px] bg-transparent px-[18px] text-center text-[13px] font-medium shadow-none hover:bg-transparent sm:hidden dark:bg-transparent dark:hover:bg-transparent"
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
