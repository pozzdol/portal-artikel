'use client';

import * as React from 'react';
import { ChevronsUpDownIcon, Loader2Icon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/shadcn/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/popover';
import { cn } from '@/lib/cn';

export type ComboboxProps<T> = {
  items: T[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** Provide to drive an async/remote search; omit for local (cmdk) filtering of `items`. */
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Generic searchable picker: shadcn Popover + Command (no @base-ui). Backs every
 * taxonomy/author/article/page picker in admin/. */
export function Combobox<T>({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  placeholder = 'Pilih…',
  emptyText = 'Tidak ada hasil.',
  searchPlaceholder = 'Cari…',
  onSearch,
  isLoading,
  allowClear = false,
  disabled,
  className,
  id,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selected = React.useMemo(
    () => items.find((it) => getKey(it) === value),
    [items, getKey, value],
  );

  function handleSearch(next: string) {
    setQuery(next);
    onSearch?.(next);
  }

  function handleSelect(item: T) {
    onChange(getKey(item));
    setOpen(false);
    setQuery('');
    onSearch?.('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          onSearch?.('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? getLabel(selected) : placeholder}
          </span>
          <span className="ml-2 flex shrink-0 items-center gap-1.5">
            {allowClear && value != null ? (
              <XIcon
                role="button"
                aria-label="Bersihkan pilihan"
                className="size-3.5 opacity-60 hover:opacity-100"
                onClick={handleClear}
              />
            ) : null}
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={!onSearch}>
          <CommandInput
            value={query}
            onValueChange={handleSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                Memuat…
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => {
                    const key = getKey(item);
                    return (
                      <CommandItem
                        key={key}
                        value={getLabel(item)}
                        data-checked={key === value}
                        onSelect={() => handleSelect(item)}
                      >
                        {getLabel(item)}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
