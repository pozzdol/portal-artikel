'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { LogOutIcon, MonitorSmartphoneIcon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/shadcn/alert-dialog';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/shadcn/table';
import { useRevokeSession, useSessions } from '@/lib/api/admin/auth';
import type { SessionInfo } from '@/lib/api/admin/types';
import { formatWib, relativeWib } from '@/lib/datetime';
import { toastApiError } from '@/lib/forms/serverErrors';

import { describeUserAgent } from './user-agent';

/** Active sessions (refresh-token families) with "Keluarkan". */
export function SessionsTable() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<SessionInfo | null>(null);

  const confirm = async () => {
    if (!target) return;
    const current = target.current;
    try {
      await revoke.mutateAsync({ familyId: target.family_id, current });
      if (!current) toast.success('Sesi dikeluarkan.');
      setTarget(null);
    } catch (err) {
      toastApiError(err);
    }
  };

  if (sessions.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (sessions.isError) {
    return (
      <div className="text-meta flex items-center gap-3">
        Daftar sesi gagal dimuat.
        <Button
          variant="outline"
          size="sm"
          onClick={() => void sessions.refetch()}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  const rows = sessions.data;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Perangkat</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Terakhir aktif</TableHead>
            <TableHead>Masuk sejak</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Aksi</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-meta py-6 text-center">
                Tidak ada sesi aktif.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.family_id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <MonitorSmartphoneIcon className="text-meta size-4 shrink-0" />
                    <span
                      className="font-medium"
                      title={s.user_agent ?? undefined}
                    >
                      {describeUserAgent(s.user_agent)}
                    </span>
                    {s.current ? (
                      <Badge
                        variant="outline"
                        className="border-gold text-gold-strong"
                      >
                        Sesi ini
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-meta tabular-nums">
                  {s.ip ?? '–'}
                </TableCell>
                <TableCell
                  title={formatWib(s.last_used_at, "d MMM yyyy, HH:mm 'WIB'")}
                >
                  {relativeWib(s.last_used_at)}
                </TableCell>
                <TableCell className="text-meta">
                  {formatWib(s.started_at, "d MMM yyyy, HH:mm 'WIB'")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTarget(s)}
                  >
                    <LogOutIcon />
                    Keluarkan
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.current
                ? 'Keluar dari sesi ini?'
                : 'Keluarkan sesi ini?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.current
                ? 'Ini sesi yang sedang Anda pakai. Anda akan langsung diarahkan ke halaman masuk.'
                : `${describeUserAgent(target?.user_agent)} harus masuk ulang untuk membuka dasbor.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revoke.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              Keluarkan sesi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
