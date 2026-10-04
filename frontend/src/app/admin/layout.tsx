import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/shadcn/sonner';
import { TooltipProvider } from '@/components/ui/shadcn/tooltip';
import { QueryProvider } from '@/lib/query/provider';

// Admin CMS root: never indexed (the proxy also sends X-Robots-Tag), one
// React Query client shared by /admin/login and the (shell) pages, admin
// density (Inter 14px; serif only for page titles and the login wordmark).
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider delayDuration={300}>
        <div className="admin-root bg-background text-foreground min-h-dvh font-sans text-[14px] leading-normal antialiased">
          {children}
        </div>
        <Toaster position="top-right" closeButton />
      </TooltipProvider>
    </QueryProvider>
  );
}
