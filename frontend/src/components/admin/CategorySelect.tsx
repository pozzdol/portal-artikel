'use client';

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import type { CategoryTreeNode } from '@/lib/api/admin/types';

const NONE = '__none__';

type Option = { id: number; label: string; depth: number };

function flattenOptions(tree: CategoryTreeNode[]): Option[] {
  const out: Option[] = [];
  for (const node of tree) {
    out.push({ id: node.id, label: node.name, depth: 0 });
    for (const child of node.children ?? []) {
      out.push({ id: child.id, label: child.name, depth: 1 });
    }
  }
  return out;
}

export type CategorySelectProps = {
  value: number | null;
  onChange: (id: number | null) => void;
  /** Full 2-level tree, already loaded by the caller (e.g. useCategoryTree()). */
  tree: CategoryTreeNode[];
  placeholder?: string;
  /** Show a "no parent" option (the category form's "induk" field). */
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
};

/** Bounded category dropdown for a pre-loaded tree (e.g. picking a parent category). */
export function CategorySelect({
  value,
  onChange,
  tree,
  placeholder = 'Pilih kategori…',
  allowNone,
  noneLabel = 'Tanpa induk',
  disabled,
  id,
}: CategorySelectProps) {
  const options = React.useMemo(() => flattenOptions(tree), [tree]);

  return (
    <Select
      value={value === null ? NONE : String(value)}
      onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((opt) => (
          <SelectItem key={opt.id} value={String(opt.id)}>
            {opt.depth > 0 ? `— ${opt.label}` : opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
