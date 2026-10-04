'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useAuthors } from '@/lib/api/admin/users';

const NONE = '__none__';

export type AuthorSelectProps = {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
};

/** Author dropdown for the article/event/alumni forms (GET /admin/authors). */
export function AuthorSelect({
  value,
  onChange,
  placeholder = 'Pilih penulis…',
  allowNone,
  noneLabel = 'Tidak ditentukan',
  disabled,
  id,
}: AuthorSelectProps) {
  const { data, isLoading } = useAuthors();
  const options = data ?? [];

  return (
    <Select
      value={value === null ? NONE : String(value)}
      onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={isLoading ? 'Memuat…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.title ? `${a.display_name} — ${a.title}` : a.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
