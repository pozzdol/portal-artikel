'use client';

import * as React from 'react';

import { Combobox } from './Combobox';
import { usePublicTags } from '@/lib/api/admin/taxonomy';
import { useDebounce } from '@/lib/hooks/useDebounce';

export type TagComboboxProps = {
  value: string | null;
  onChange: (slug: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
};

/** Single-tag picker by slug (x-ui: tag_slug), searched server-side. */
export function TagCombobox({
  value,
  onChange,
  placeholder = 'Pilih tag…',
  allowClear = true,
  disabled,
  id,
}: TagComboboxProps) {
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 300);
  const { data, isLoading } = usePublicTags(debounced || undefined);
  const items = data?.items ?? [];

  return (
    <Combobox
      id={id}
      items={items}
      value={value}
      onChange={(v) => onChange(v as string | null)}
      getKey={(t) => t.slug}
      getLabel={(t) => t.name}
      placeholder={placeholder}
      emptyText="Tag tidak ditemukan."
      onSearch={setQuery}
      isLoading={isLoading}
      allowClear={allowClear}
      disabled={disabled}
    />
  );
}
