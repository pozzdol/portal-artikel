'use client';

import * as React from 'react';

import { Combobox } from './Combobox';
import { usePublicCategoryTree } from '@/lib/api/admin/taxonomy';
import type { CategoryTreeNode } from '@/lib/api/admin/types';

type Option = { slug: string; label: string };

function flatten(tree: CategoryTreeNode[], level?: 1 | 2): Option[] {
  const out: Option[] = [];
  for (const node of tree) {
    if (level == null || level === 1) {
      out.push({ slug: node.slug, label: node.name });
    }
    if (level == null || level === 2) {
      for (const child of node.children ?? []) {
        out.push({
          slug: child.slug,
          label:
            level === 2 ? `${node.name} / ${child.name}` : `— ${child.name}`,
        });
      }
    }
  }
  return out;
}

export type CategoryComboboxProps = {
  value: string | null;
  onChange: (slug: string | null) => void;
  /** Restrict to top-level (1) or second-level (2) categories only; omit for both. */
  level?: 1 | 2;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
};

/** Category picker by slug (x-ui: category_slug). Uses the permission-free public tree so
 * it works for any role (homepage/section editors may lack categories.manage). */
export function CategoryCombobox({
  value,
  onChange,
  level,
  placeholder = 'Pilih kategori…',
  allowClear = true,
  disabled,
  id,
}: CategoryComboboxProps) {
  const { data, isLoading } = usePublicCategoryTree();
  const options = React.useMemo(
    () => flatten(data ?? [], level),
    [data, level],
  );

  return (
    <Combobox
      id={id}
      items={options}
      value={value}
      onChange={(v) => onChange(v as string | null)}
      getKey={(o) => o.slug}
      getLabel={(o) => o.label}
      placeholder={placeholder}
      emptyText="Kategori tidak ditemukan."
      isLoading={isLoading}
      allowClear={allowClear}
      disabled={disabled}
    />
  );
}
