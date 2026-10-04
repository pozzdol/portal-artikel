'use client';

import type { ReactNode } from 'react';
import { ShieldOffIcon } from 'lucide-react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/shadcn/empty';
import { useMe } from '@/lib/api/admin/auth';

import { hasAnyPermission, type PermissionCode } from './nav';

type Code = PermissionCode | (string & {});

/**
 * True when the signed-in user holds ANY of `codes` (no codes → true).
 * Reads the cached /auth/me seeded by AdminGate; false while it is unknown.
 */
export function usePermission(...codes: Code[]): boolean {
  const { data } = useMe();
  return hasAnyPermission(data?.permissions, codes);
}

/** The standard "no access" panel (403) shown by PermissionGate. */
export function ForbiddenPanel({
  title = 'Akses ditolak',
  description = 'Akun Anda tidak memiliki izin untuk membuka bagian ini. Hubungi admin bila Anda memerlukannya.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty className="border-line border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldOffIcon />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export type PermissionGateProps = {
  /** Any-of. */
  perms: readonly Code[];
  /** Rendered instead of children without permission (default: ForbiddenPanel; pass null to hide). */
  fallback?: ReactNode;
  children: ReactNode;
};

/**
 * Renders children only with permission. Wrap whole pages so their queries
 * are never fired without access; the backend still enforces everything.
 */
export function PermissionGate({
  perms,
  fallback,
  children,
}: PermissionGateProps) {
  const allowed = usePermission(...perms);
  if (allowed) return <>{children}</>;
  return <>{fallback === undefined ? <ForbiddenPanel /> : fallback}</>;
}
