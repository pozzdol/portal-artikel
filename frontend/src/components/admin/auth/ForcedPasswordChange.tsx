'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { InfoIcon, LogOutIcon } from 'lucide-react';

import { PasswordForm } from '@/components/admin/profile/PasswordForm';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import { Button } from '@/components/ui/shadcn/button';
import { useLogout } from '@/lib/api/admin/auth';
import { qk } from '@/lib/api/admin/keys';
import { refreshSession } from '@/lib/api/client';

import { beginSignOut } from '../shell/AdminGate';

/**
 * Forced first-login password change. The server bumps perm_version on
 * success, so the access token is stale: refresh it before entering /admin.
 */
export function ForcedPasswordChange() {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useLogout();

  const done = async () => {
    await refreshSession();
    qc.removeQueries({ queryKey: qk.all });
    router.replace('/admin');
  };

  const signOut = async () => {
    beginSignOut();
    try {
      await logout.mutateAsync();
    } catch {
      // Cookies may already be gone; the login page is the right place anyway.
    }
    window.location.replace('/admin/login');
  };

  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <InfoIcon />
        <AlertDescription>
          Demi keamanan, Anda wajib mengganti kata sandi awal sebelum
          menggunakan dasbor.
        </AlertDescription>
      </Alert>
      <p className="text-meta text-[13px] leading-relaxed">
        Minimal 10 karakter dan harus berbeda dari kata sandi awal. Sesi di
        perangkat lain akan dikeluarkan.
      </p>
      <PasswordForm
        autoFocus
        submitLabel="Simpan kata sandi baru"
        successMessage="Kata sandi diperbarui. Selamat datang di dasbor."
        onSuccess={done}
      />
      <div className="border-line mt-5 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          className="text-meta h-auto min-h-11 px-0"
          disabled={logout.isPending}
          onClick={() => void signOut()}
        >
          <LogOutIcon />
          Keluar
        </Button>
      </div>
    </div>
  );
}
