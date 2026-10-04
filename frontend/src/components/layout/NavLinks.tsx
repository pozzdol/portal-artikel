'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { MenuItem } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';

const GAP = 22;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: MenuItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      target={item.open_new_tab ? '_blank' : undefined}
      rel={item.open_new_tab ? 'noopener noreferrer' : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'border-b-2 pb-1',
        active ? 'border-gold' : 'hover:border-line border-transparent',
      )}
    >
      {item.label}
    </Link>
  );
}

/**
 * Overflow-aware primary nav. Renders every item into a hidden, invisible
 * measurement row once (same markup/classes as the visible row) to read each
 * item's rendered width, then decides how many items fit inline for the
 * current nav width and moves the rest into a "Lainnya" dropdown. Initial
 * state renders all items inline (matches SSR, no hydration mismatch); the
 * wrapper stays `overflow-hidden` so nothing visually overlaps before the
 * first client-side measurement pass.
 */
export function NavLinks({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const available = container.offsetWidth;
    const widths = itemRefs.current.map((el) => el?.offsetWidth ?? 0);
    const totalAll =
      widths.reduce((a, b) => a + b, 0) + GAP * Math.max(widths.length - 1, 0);
    if (totalAll <= available) {
      setVisibleCount(items.length);
      return;
    }
    const triggerWidth = triggerRef.current?.offsetWidth ?? 0;
    let used = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i += 1) {
      const next = used + (count > 0 ? GAP : 0) + widths[i];
      if (next + GAP + triggerWidth <= available) {
        used = next;
        count += 1;
      } else {
        break;
      }
    }
    setVisibleCount(count);
  }, [items.length]);

  useLayoutEffect(() => {
    recalc();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => recalc());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recalc]);

  if (!items.length) return null;

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;
  const overflowActive = overflowItems.some((item) =>
    isActive(pathname, item.href),
  );

  return (
    <div
      ref={containerRef}
      className="relative hidden min-w-0 flex-1 items-center justify-center overflow-hidden xl:flex"
    >
      <nav
        aria-label="Navigasi utama"
        className="flex flex-nowrap items-center gap-[22px] text-[14.5px] font-medium whitespace-nowrap"
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
        {hasOverflow ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 border-b-2 pb-1 outline-none',
                  overflowActive
                    ? 'border-gold'
                    : 'hover:border-line border-transparent',
                )}
              >
                Lainnya
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-line bg-paper w-auto min-w-40 rounded-none p-1"
            >
              {overflowItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <DropdownMenuItem
                    key={item.id}
                    asChild
                    className="rounded-none text-[14.5px] font-medium"
                  >
                    <Link
                      href={item.href}
                      target={item.open_new_tab ? '_blank' : undefined}
                      rel={
                        item.open_new_tab ? 'noopener noreferrer' : undefined
                      }
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'text-gold' : undefined}
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>

      {/* Hidden measurement row: identical markup to the visible row above,
          used only to read each item's width via ref before deciding how
          many items fit. Never visible, never interactive. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap items-center gap-[22px] text-[14.5px] font-medium whitespace-nowrap"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
          >
            <NavLink item={item} active={isActive(pathname, item.href)} />
          </div>
        ))}
        <div
          ref={triggerRef}
          className="flex items-center gap-1 border-b-2 pb-1"
        >
          Lainnya
          <ChevronDown className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
