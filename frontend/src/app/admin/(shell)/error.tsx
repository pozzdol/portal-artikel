'use client';

import { useEffect } from 'react';
import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/shadcn/empty';

export default function AdminError({
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
    <Empty className="border-line border py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">
          Bagian ini gagal dimuat
        </EmptyTitle>
        <EmptyDescription>
          Terjadi kesalahan saat menampilkan halaman. Perubahan yang sudah
          disimpan tetap aman; coba muat ulang.
          {error.digest ? (
            <span className="mt-2 block text-xs">Kode: {error.digest}</span>
          ) : null}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => retry()}>
          <RotateCwIcon />
          Coba lagi
        </Button>
      </EmptyContent>
    </Empty>
  );
}
