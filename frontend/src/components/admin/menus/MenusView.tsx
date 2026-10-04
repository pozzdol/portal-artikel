'use client';

import * as React from 'react';

import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminBreadcrumb } from '@/components/admin/shell/AdminBreadcrumb';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import { useMenus } from '@/lib/api/admin/menus';
import { UNSAVED_MESSAGE } from '@/lib/hooks/useUnsavedChanges';

import { MenuEditor } from './MenuEditor';

/** header gets 2 levels (top + one level of children); footers are flat. */
function maxDepthFor(code: string): 1 | 2 {
  return code === 'header' ? 2 : 1;
}

/** Menu picker (Header / Footer · Kategori / Footer · Tentang / Footer ·
 * Legal) + drag-and-drop tree editor, one code at a time (docs/07 §3.10). */
export function MenusView() {
  const { data: menus, isLoading } = useMenus();
  const [activeCode, setActiveCode] = React.useState('header');
  const dirtyByCode = React.useRef<Record<string, boolean>>({});

  function handleTabChange(next: string) {
    if (next === activeCode) return;
    if (dirtyByCode.current[activeCode] && !window.confirm(UNSAVED_MESSAGE)) {
      return;
    }
    setActiveCode(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu"
        description="Susun item navigasi header dan footer. Tombol Simpan mengganti seluruh pohon menu ini."
        breadcrumb={<AdminBreadcrumb />}
      />
      {isLoading || !menus ? (
        <ListPageSkeleton rows={4} columns={1} />
      ) : (
        <Tabs value={activeCode} onValueChange={handleTabChange}>
          <TabsList>
            {menus.map((m) => (
              <TabsTrigger key={m.code} value={m.code}>
                {m.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {menus.map((m) => (
            <TabsContent key={m.code} value={m.code} className="pt-4">
              <MenuEditor
                menu={m}
                maxDepth={maxDepthFor(m.code)}
                onDirtyChange={(dirty) => {
                  dirtyByCode.current[m.code] = dirty;
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
