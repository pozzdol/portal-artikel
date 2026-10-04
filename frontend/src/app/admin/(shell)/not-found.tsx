import Link from 'next/link';
import { CompassIcon } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/shadcn/empty';

export default function AdminNotFound() {
  return (
    <Empty className="border-line border py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CompassIcon />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">
          Halaman tidak ditemukan
        </EmptyTitle>
        <EmptyDescription>
          Alamat ini tidak ada di dasbor, atau datanya sudah dihapus. Periksa
          tautannya, atau kembali ke dasbor.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/admin">Kembali ke dasbor</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
