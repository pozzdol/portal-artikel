'use client';

import * as React from 'react';

import { Combobox } from './Combobox';
import { useArticle, useArticles } from '@/lib/api/admin/articles';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminArticleItem } from '@/lib/api/admin/types';

export type ArticleSearchComboboxProps = {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
};

/** Article picker by id (x-ui: article_id), searched server-side by title. */
export function ArticleSearchCombobox({
  value,
  onChange,
  placeholder = 'Cari artikel…',
  allowClear = true,
  disabled,
  id,
}: ArticleSearchComboboxProps) {
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 300);
  const { data, isLoading } = useArticles({
    q: debounced || undefined,
    per_page: 20,
  });
  // The search results may not include the already-selected article; fetch it directly so
  // the trigger button never shows a blank/id-only label.
  const selected = useArticle(value ?? undefined);

  const items = React.useMemo<AdminArticleItem[]>(() => {
    const list = data?.items ?? [];
    if (value != null && selected.data && !list.some((a) => a.id === value)) {
      return [selected.data, ...list];
    }
    return list;
  }, [data, selected.data, value]);

  return (
    <Combobox
      id={id}
      items={items}
      value={value}
      onChange={(v) => onChange(v as number | null)}
      getKey={(a) => a.id}
      getLabel={(a) => a.title}
      placeholder={placeholder}
      emptyText="Artikel tidak ditemukan."
      onSearch={setQuery}
      isLoading={isLoading || selected.isLoading}
      allowClear={allowClear}
      disabled={disabled}
    />
  );
}
