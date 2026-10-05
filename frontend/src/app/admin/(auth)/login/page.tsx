import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

import { LoginForm } from '@/components/admin/auth/LoginForm';
import { safeNext } from '@/components/admin/auth/safe-next';
import {
  ACCESS_COOKIE,
  fetchServerMe,
  getAdminBrand,
} from '@/components/admin/auth/server-session';
import { Button } from '@/components/ui/shadcn/button';

export const metadata: Metadata = { title: 'Masuk' };

export default async function AdminLoginPage({
  searchParams,
}: PageProps<'/admin/login'>) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  // Already signed in → straight to the target page.
  const store = await cookies();
  let tryRefresh = false;
  if (store.get(ACCESS_COOKIE)?.value) {
    const session = await fetchServerMe(store.toString());
    if (session.status === 'ok') redirect(next);
    tryRefresh = session.status === 'unknown';
  }

  const brand = await getAdminBrand();

  return (
    <main className="flex min-h-dvh flex-col px-5 py-12 sm:items-center sm:justify-center sm:py-16">
      <div className="w-full sm:max-w-[380px]">
        <header className="mb-10">
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
            Masuk ke dasbor redaksi {brand.tagline}
          </h1>
        </header>

        <LoginForm next={next} tryRefresh={tryRefresh} />

        <div className="border-line mt-10 border-t pt-5">
          <Button
            asChild
            variant="link"
            className="text-meta hover:text-ink inline-flex h-auto min-h-11 items-center px-0 py-2"
          >
            <Link href="/">
              <ArrowLeftIcon />
              Kembali ke situs
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
