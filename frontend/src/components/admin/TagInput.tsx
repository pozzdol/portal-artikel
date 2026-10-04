'use client';

import * as React from 'react';
import { PlusIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/shadcn/badge';
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
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/popover';
import { usePublicTags } from '@/lib/api/admin/taxonomy';
import { useDebounce } from '@/lib/hooks/useDebounce';

export type TagInputValue = {
  /** Existing tag ids already attached. */
  ids: number[];
  /** New tag names to be created on save (article_ids/new_tags on ArticleInput). */
  newTags: string[];
};

export type KnownTag = { id: number; name: string; slug?: string };

export type TagInputProps = {
  value: TagInputValue;
  onChange: (value: TagInputValue) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /**
   * Tags already known by the caller (e.g. the loaded article's `tags`), used to label
   * chips whose id isn't in the current (query-filtered) search results — otherwise
   * such a chip would fall back to showing "#id".
   */
  knownTags?: KnownTag[];
};

/** Multi-select tag picker with inline "create new tag" (docs 07 §3.4). */
export function TagInput({
  value,
  onChange,
  label = 'Tag',
  placeholder = 'Cari atau buat tag…',
  disabled,
  id,
  knownTags,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 300);
  const { data, isLoading } = usePublicTags(debounced || undefined);
  const results = data?.items ?? [];
  const options = results.filter((t) => !value.ids.includes(t.id));

  const trimmed = query.trim();
  const exactExists =
    trimmed.length > 0 &&
    results.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const alreadyNew = value.newTags.some(
    (t) => t.toLowerCase() === trimmed.toLowerCase(),
  );

  function addExisting(tagId: number) {
    onChange({ ...value, ids: [...value.ids, tagId] });
    setQuery('');
  }
  function removeExisting(tagId: number) {
    onChange({ ...value, ids: value.ids.filter((id) => id !== tagId) });
  }
  function addNew(name: string) {
    const t = name.trim();
    if (!t) return;
    onChange({ ...value, newTags: [...value.newTags, t] });
    setQuery('');
  }
  function removeNew(name: string) {
    onChange({ ...value, newTags: value.newTags.filter((t) => t !== name) });
  }

  // Chip labels for existing ids come from the current search results, falling back to
  // the caller-supplied `knownTags` (e.g. the loaded article's own tags) when the id
  // isn't in the (query-filtered) result set, and only then to the bare id.
  const labelFor = (tagId: number) =>
    results.find((t) => t.id === tagId)?.name ??
    knownTags?.find((t) => t.id === tagId)?.name ??
    `#${tagId}`;

  return (
    <Field>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <div className="border-input flex flex-wrap items-center gap-1.5 rounded-md border bg-transparent p-1.5">
        {value.ids.map((tagId) => (
          <Badge key={`id-${tagId}`} variant="secondary" className="gap-1">
            {labelFor(tagId)}
            <button
              type="button"
              onClick={() => removeExisting(tagId)}
              aria-label={`Hapus tag ${labelFor(tagId)}`}
              disabled={disabled}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        {value.newTags.map((name) => (
          <Badge
            key={`new-${name}`}
            variant="outline"
            className="gap-1 border-dashed"
          >
            {name}
            <span className="text-muted-foreground text-[10px]">(baru)</span>
            <button
              type="button"
              onClick={() => removeNew(name)}
              aria-label={`Hapus tag ${name}`}
              disabled={disabled}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              id={id}
              disabled={disabled}
              className="text-muted-foreground h-7 gap-1 px-2"
            >
              <PlusIcon className="size-3.5" />
              Tambah
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={placeholder}
              />
              <CommandList>
                {isLoading ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    Memuat…
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {trimmed
                        ? 'Tidak ditemukan.'
                        : 'Ketik untuk mencari tag.'}
                    </CommandEmpty>
                    {options.length > 0 ? (
                      <CommandGroup heading="Tag tersedia">
                        {options.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={t.name}
                            onSelect={() => addExisting(t.id)}
                          >
                            {t.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : null}
                    {trimmed && !exactExists && !alreadyNew ? (
                      <CommandGroup heading="Buat baru">
                        <CommandItem
                          value={`__new__${trimmed}`}
                          onSelect={() => addNew(trimmed)}
                        >
                          <PlusIcon className="size-3.5" />
                          Buat “{trimmed}”
                        </CommandItem>
                      </CommandGroup>
                    ) : null}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <FieldDescription>
        Cari tag yang ada, atau ketik nama baru untuk membuatnya saat disimpan.
      </FieldDescription>
    </Field>
  );
}
