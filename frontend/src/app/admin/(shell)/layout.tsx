import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  ACCESS_COOKIE,
  fetchServerMe,
  getAdminBrand,
} from '@/components/admin/auth/server-session';
import { AdminShell } from '@/components/admin/shell/AdminShell';

// Server half of the admin guard (the proxy already redirected requests
// without a cookie, keeping ?next=). A session Go rejects outright goes to the
// login page; an expired token or unreachable API renders the shell with
// initialMe=null and lets the client refresh (the refresh cookie is scoped to
// /api/v1/auth, so it never reaches this layout).
export default async function AdminShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const store = await cookies();
  if (!store.get(ACCESS_COOKIE)?.value) redirect('/admin/login');

  const [session, brand] = await Promise.all([
    fetchServerMe(store.toString()),
    getAdminBrand(),
  ]);
  if (session.status === 'unauthenticated') redirect('/admin/login');

  return (
    <AdminShell
      initialMe={session.status === 'ok' ? session.me : null}
      brand={{ name: brand.name, logoUrl: brand.logoUrl }}
      defaultOpen={store.get('sidebar_state')?.value !== 'false'}
    >
      {children}
    </AdminShell>
  );
}
