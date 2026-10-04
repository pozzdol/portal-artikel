'use client';

import { ArrowUpRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Separator } from '@/components/ui/shadcn/separator';
import { SidebarTrigger } from '@/components/ui/shadcn/sidebar';

import { AdminBreadcrumb } from './AdminBreadcrumb';
import { UserMenu } from './UserMenu';

export function AdminTopbar() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/85 border-line sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-5">
      <SidebarTrigger className="-ml-1" aria-label="Buka/tutup sidebar" />
      <Separator
        orientation="vertical"
        className="mr-1 h-5 data-vertical:self-center"
      />
      <AdminBreadcrumb />
      <div className="ml-auto flex items-center gap-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-meta hover:text-ink"
        >
          <a href="/" target="_blank" rel="noopener">
            <span className="hidden sm:inline">Lihat situs</span>
            <ArrowUpRightIcon />
            <span className="sr-only sm:hidden">Lihat situs (tab baru)</span>
          </a>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
