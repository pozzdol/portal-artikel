'use client';

import { useId, useState, type FormEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { Link2, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/popover';
import { Toggle } from '@/components/ui/shadcn/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';

import { normalizeHref } from './extensions/SafeLink';

export type LinkPopoverProps = {
  editor: Editor;
  active: boolean;
  disabled?: boolean;
};

const INVALID_MESSAGE =
  'Tautan tidak valid. Gunakan alamat https://, mailto:, atau tautan internal yang diawali /.';

/** Add, edit or remove a link on the current selection. */
export function LinkPopover({ editor, active, disabled }: LinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  function handleOpenChange(next: boolean) {
    if (next) {
      const href = editor.getAttributes('link').href;
      setValue(typeof href === 'string' ? href : '');
      setError(null);
    }
    setOpen(next);
  }

  function apply(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const href = normalizeHref(value);
    if (!href) {
      setError(INVALID_MESSAGE);
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain
        .insertContent({
          type: 'text',
          text: value.trim(),
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }
    setOpen(false);
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Toggle
              size="sm"
              pressed={active}
              disabled={disabled}
              aria-label="Tautan"
            >
              <Link2 />
            </Toggle>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Tautan</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <form onSubmit={apply} className="grid gap-2" noValidate>
          <label htmlFor={inputId} className="text-sm font-medium">
            Alamat tautan
          </label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://… atau /kategori/berita"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
          />
          {error ? (
            <p id={errorId} className="text-destructive text-xs">
              {error}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Tautan ke situs lain otomatis dibuka di tab baru.
            </p>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            {active ? (
              <Button type="button" variant="ghost" size="sm" onClick={remove}>
                <Unlink />
                Hapus tautan
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm">
              Terapkan
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
