'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/shadcn/button';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <h1 className="font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
        Terjadi kesalahan saat memuat halaman.
      </h1>
      <p className="text-soft max-w-[560px] text-[17px] leading-[1.7]">
        Silakan coba lagi. Jika masalah ini terus berulang, kembali ke beranda
        dan coba dari sana.
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => retry()}
          className="border-ink h-auto rounded-[8px] bg-transparent px-[18px] py-[9px] text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          Coba lagi
        </Button>
        <Link
          href="/"
          className="border-ink border-b pb-0.5 text-[13.5px] font-medium"
        >
          Beranda
        </Link>
      </div>
    </Container>
  );
}
