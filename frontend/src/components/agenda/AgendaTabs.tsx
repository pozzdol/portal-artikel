import Link from 'next/link';

import { cn } from '@/lib/cn';

export type AgendaTab = 'mendatang' | 'selesai';

const TABS: { key: AgendaTab; label: string }[] = [
  { key: 'mendatang', label: 'Mendatang' },
  { key: 'selesai', label: 'Selesai' },
];

type AgendaTabsProps = {
  active: AgendaTab;
  hrefFor: (tab: AgendaTab) => string;
};

/** "Mendatang" / "Selesai" filter for the agenda listing; active tab gets a gold underline. */
export function AgendaTabs({ active, hrefFor }: AgendaTabsProps) {
  return (
    <nav
      aria-label="Filter agenda"
      className="border-line mb-8 flex gap-8 border-b"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center border-b-2 pb-3 text-[14.5px] font-medium lg:min-h-0',
              isActive
                ? 'border-gold text-ink'
                : 'text-faint hover:text-ink border-transparent',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
