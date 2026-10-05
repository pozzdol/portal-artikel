'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCwIcon, ServerCrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/shadcn/empty';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { useMe } from '@/lib/api/admin/auth';
import { qk } from '@/lib/api/admin/keys';
import type { Me } from '@/lib/api/admin/types';
import { apiErrorMessage } from '@/lib/forms/serverErrors';
import {
  isApiClientError,
  PASSWORD_CHANGE_REQUIRED_EVENT,
  UNAUTHENTICATED_EVENT,
} from '@/lib/api/client';
import { CHANGE_PASSWORD_PATH } from '@/components/admin/auth/safe-next';

let signingOut = false;

/** Call before logging out so the gate does not bounce to /admin/login?next=…. */
export function beginSignOut(): void {
  signingOut = true;
}

/** /admin/login?next=<current path+search> */
export function loginUrlFor(pathname: string, search = ''): string {
  const next = `${pathname}${search}`;
  return next && next !== '/admin'
    ? `/admin/login?next=${encodeURIComponent(next)}`
    : '/admin/login?next=%2Fadmin';
}

export type AdminGateProps = {
  /** /auth/me from the server layout; null when it could not be verified there. */
  initialMe: Me | null;
  children: ReactNode;
};

/**
 * Client half of the admin guard: seeds the /auth/me cache, shows a skeleton
 * while the session is being confirmed (the client refreshes an expired
 * token), and sends the user to the login page when the session is gone.
 */
export function AdminGate({ initialMe, children }: AdminGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const me = useMe(initialMe ? { initialData: initialMe } : {});
  const redirected = useRef(false);

  const toLogin = useCallback(() => {
    if (signingOut || redirected.current) return;
    redirected.current = true;
    qc.removeQueries({ queryKey: qk.all });
    router.replace(loginUrlFor(pathname, window.location.search));
  }, [qc, router, pathname]);

  useEffect(() => {
    window.addEventListener(UNAUTHENTICATED_EVENT, toLogin);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, toLogin);
  }, [toLogin]);

  const toChangePassword = useCallback(() => {
    if (signingOut || redirected.current) return;
    redirected.current = true;
    router.replace(CHANGE_PASSWORD_PATH);
  }, [router]);

  useEffect(() => {
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, toChangePassword);
    return () =>
      window.removeEventListener(
        PASSWORD_CHANGE_REQUIRED_EVENT,
        toChangePassword,
      );
  }, [toChangePassword]);

  const mustChange = me.data?.must_change_password === true;
  useEffect(() => {
    if (mustChange) toChangePassword();
  }, [mustChange, toChangePassword]);

  const unauthenticated =
    me.isError && isApiClientError(me.error) && me.error.status === 401;

  useEffect(() => {
    if (unauthenticated) toLogin();
  }, [unauthenticated, toLogin]);

  if (mustChange) return <ShellSkeleton />;
  if (me.data) return <>{children}</>;
  if (me.isError && !unauthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerCrashIcon />
            </EmptyMedia>
            <EmptyTitle className="font-serif text-2xl">
              Dasbor belum bisa dimuat
            </EmptyTitle>
            <EmptyDescription>
              {apiErrorMessage(me.error)} Periksa koneksi Anda, lalu coba lagi.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void me.refetch()}>
              <RotateCwIcon />
              Coba lagi
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }
  return <ShellSkeleton />;
}

/** Placeholder with the shell's geometry while the session is confirmed. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Memuat dasbor">
      <div className="border-line hidden w-64 shrink-0 flex-col gap-3 border-r p-4 md:flex">
        <Skeleton className="mb-4 h-8 w-36" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="border-line flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto size-8 rounded-full" />
        </div>
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
