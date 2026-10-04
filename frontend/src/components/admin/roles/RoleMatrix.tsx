'use client';

import * as React from 'react';

import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import type { Permission } from '@/lib/api/admin/types';

const GROUP_LABEL: Record<string, string> = {
  dashboard: 'Dasbor',
  articles: 'Artikel',
  categories: 'Kategori',
  tags: 'Tag',
  media: 'Media',
  events: 'Agenda',
  alumni: 'Alumni',
  videos: 'Video',
  pages: 'Halaman statis',
  snippets: 'Snippet',
  homepage: 'Beranda',
  menus: 'Menu',
  authors: 'Penulis',
  settings: 'Pengaturan',
  users: 'Pengguna',
  roles: 'Role',
  audit: 'Log aktivitas',
};

function groupOf(code: string): string {
  return code.split('.')[0] ?? code;
}

function groupPermissions(permissions: Permission[]) {
  const byGroup = new Map<string, Permission[]>();
  for (const p of permissions) {
    const g = groupOf(p.code);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(p);
  }
  return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type RoleMatrixProps = {
  permissions: Permission[];
  value: string[];
  onChange: (codes: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/** Permission checkbox matrix grouped by resource (docs 07 §3.12). */
export function RoleMatrix({
  permissions,
  value,
  onChange,
  isLoading,
  disabled,
}: RoleMatrixProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const groups = groupPermissions(permissions);
  const selected = new Set(value);

  function toggleOne(code: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
    onChange([...next]);
  }

  function toggleGroup(codes: string[], checked: boolean) {
    const next = new Set(selected);
    for (const c of codes) {
      if (checked) next.add(c);
      else next.delete(c);
    }
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([group, perms]) => {
        const codes = perms.map((p) => p.code);
        const allChecked = codes.every((c) => selected.has(c));
        const someChecked = !allChecked && codes.some((c) => selected.has(c));
        return (
          <fieldset key={group} className="border-line border p-3">
            <legend className="text-sm font-medium">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={someChecked ? 'indeterminate' : allChecked}
                  disabled={disabled}
                  onCheckedChange={(c) => toggleGroup(codes, c === true)}
                />
                {GROUP_LABEL[group] ?? group}
              </label>
            </legend>
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {perms.map((p) => (
                <label
                  key={p.code}
                  className="flex items-start gap-2 text-sm font-normal"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(p.code)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggleOne(p.code, c === true)}
                  />
                  <span>
                    {p.description}
                    <span className="text-muted-foreground block text-xs">
                      {p.code}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
