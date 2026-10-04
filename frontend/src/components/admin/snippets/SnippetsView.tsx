'use client';

import * as React from 'react';

import { PageHeader } from '@/components/admin/PageHeader';
import { AdminBreadcrumb } from '@/components/admin/shell/AdminBreadcrumb';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import type { SnippetType } from '@/lib/api/admin/types';

import { SNIPPET_TABS } from './helpers';
import { SnippetTypePanel } from './SnippetTypePanel';

/** Snippet manager: 4 tabs (Pengumuman/Breaking/Kutipan/FAQ), each a
 * drag-to-reorder list (docs/07 §3.8). */
export function SnippetsView() {
  const [tab, setTab] = React.useState<SnippetType>('announcement');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Snippet"
        description="Pengumuman, breaking news, kutipan berputar, dan pertanyaan umum yang tampil di beranda."
        breadcrumb={<AdminBreadcrumb />}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as SnippetType)}>
        <TabsList>
          {SNIPPET_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SNIPPET_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="pt-4">
            <SnippetTypePanel type={t.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
