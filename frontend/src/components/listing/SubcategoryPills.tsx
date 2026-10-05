import Link from 'next/link';

import { Badge } from '@/components/ui/shadcn/badge';
import type { CategoryNode } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type SubcategoryPillsProps = {
  /** Category path, e.g. "/kajian" — pill hrefs are `${baseHref}` / `${baseHref}?sub=slug`. */
  baseHref: string;
  items: CategoryNode[];
  /** Active child slug, already validated against `items`. */
  activeSlug?: string;
};

const pillBase =
  'min-h-11 w-fit shrink-0 rounded-full px-4 text-[13px] font-medium normal-case transition-colors lg:min-h-0 lg:px-3.5 lg:py-1.5 lg:text-[12.5px]';

const activePillClass =
  'border-ink bg-ink text-paper hover:border-ink [a]:hover:bg-ink [a]:hover:text-paper';

const inactivePillClass =
  'border-line text-ink hover:border-ink [a]:hover:bg-transparent [a]:hover:text-ink';

/** "Semua" + one pill per subcategory; the active pill is filled ink. */
export function SubcategoryPills({
  baseHref,
  items,
  activeSlug,
}: SubcategoryPillsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Subkategori"
      className="no-scrollbar -mx-5 mb-8 flex flex-nowrap gap-2.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mb-11 sm:flex-wrap sm:px-0"
    >
      <Badge
        asChild
        variant="outline"
        className={cn(
          pillBase,
          !activeSlug ? activePillClass : inactivePillClass,
        )}
      >
        <Link href={baseHref}>Semua</Link>
      </Badge>
      {items.map((child) => {
        const isActive = child.slug === activeSlug;
        return (
          <Badge
            key={child.slug}
            asChild
            variant="outline"
            className={cn(
              pillBase,
              isActive ? activePillClass : inactivePillClass,
            )}
          >
            <Link href={`${baseHref}?sub=${child.slug}`}>{child.name}</Link>
          </Badge>
        );
      })}
    </nav>
  );
}
