import type { Metadata } from 'next';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ForcedPasswordChange } from '@/components/admin/auth/ForcedPasswordChange';
import { CHANGE_PASSWORD_PATH } from '@/components/admin/auth/safe-next';
import {
  ACCESS_COOKIE,
  fetchServerMe,
  getAdminBrand,
} from '@/components/admin/auth/server-session';

export const metadata: Metadata = { title: 'Ganti kata sandi' };

const LOGIN_NEXT = `/admin/login?next=${encodeURIComponent(CHANGE_PASSWORD_PATH)}`;

export default async function AdminChangePasswordPage() {
  const store = await cookies();
  if (!store.get(ACCESS_COOKIE)?.value) redirect(LOGIN_NEXT);

  const session = await fetchServerMe(store.toString());
  if (session.status === 'unauthenticated') redirect('/admin/login');
  if (session.status === 'ok' && !session.me.must_change_password) {
    redirect('/admin');
  }
  // 'unknown' (expired token): render; the client refreshes on submit.

  const brand = await getAdminBrand();

  return (
    <main className="flex min-h-dvh flex-col px-5 py-12 sm:items-center sm:justify-center sm:py-16">
      <div className="w-full sm:max-w-[420px]">
        <header className="mb-8">
          <Image
            src={brand.logoUrl}
            alt=""
            width={44}
            height={44}
            className="mb-5 size-11 object-contain"
            priority
          />
          <p
            aria-hidden="true"
            className="font-serif text-[44px] leading-none font-bold tracking-[0.03em]"
          >
            {brand.name}
          </p>
          <div aria-hidden="true" className="bg-gold mt-4 mb-4 h-[2px] w-14" />
          <h1 className="text-meta text-[15px] leading-snug">
            <span className="sr-only">{brand.name}: </span>
            Ganti kata sandi
          </h1>
        </header>
        <ForcedPasswordChange />
      </div>
    </main>
  );
}
