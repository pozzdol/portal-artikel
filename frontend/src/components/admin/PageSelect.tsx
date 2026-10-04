'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { usePages } from '@/lib/api/admin/pages';

const NONE = '__none__';

export type PageSelectProps = {
  value: string | null;
  onChange: (slug: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
};

/** Static-page dropdown (menu item target link_type="page"). */
export function PageSelect({
  value,
  onChange,
  placeholder = 'Pilih halaman…',
  allowNone,
  noneLabel = 'Tidak ada',
  disabled,
  id,
}: PageSelectProps) {
  const { data, isLoading } = usePages();
  const options = data ?? [];

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={isLoading ? 'Memuat…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((p) => (
          <SelectItem key={p.id} value={p.slug}>
            {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
