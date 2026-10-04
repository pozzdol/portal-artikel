'use client';

import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/cn';

export type DataTableToolbarProps = {
  /** Filter controls (Select, ToggleGroup, …), left-aligned next to the search box. */
  children?: React.ReactNode;
  /** Right-aligned buttons, e.g. "+ Tambah". */
  actions?: React.ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  className?: string;
};

/** Search box + filters + trailing actions row above a DataTable. */
export function DataTableToolbar({
  children,
  actions,
  search,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {search ? (
          <div className="relative w-full max-w-xs">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Cari…'}
              className="pl-8"
            />
          </div>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
