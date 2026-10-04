'use client';

import type { ReactNode } from 'react';

import { SidebarInset, SidebarProvider } from '@/components/ui/shadcn/sidebar';
import type { Me } from '@/lib/api/admin/types';

import { AdminGate } from './AdminGate';
import { AdminSidebar, type AdminBrandProps } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export type AdminShellProps = {
  /** /auth/me verified by the server layout (null → confirmed client-side). */
  initialMe: Me | null;
  brand: AdminBrandProps;
  /** Desktop sidebar expanded? (from the sidebar_state cookie). */
  defaultOpen?: boolean;
  children: ReactNode;
};

export function AdminShell({
  initialMe,
  brand,
  defaultOpen = true,
  children,
}: AdminShellProps) {
  return (
    <AdminGate initialMe={initialMe}>
      <a
        href="#admin-main"
        className="bg-gold text-on-gold sr-only z-50 px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Langsung ke konten
      </a>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar brand={brand} />
        <SidebarInset className="min-w-0">
          <AdminTopbar />
          <div
            id="admin-main"
            tabIndex={-1}
            className="flex-1 px-4 py-6 outline-none md:px-8 md:py-8"
          >
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminGate>
  );
}
