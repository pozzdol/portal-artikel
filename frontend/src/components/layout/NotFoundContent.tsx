import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/shadcn/button';

export async function NotFoundContent() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <h1 className="font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
        404 — Halaman tidak ditemukan
      </h1>
      <p className="text-soft max-w-[560px] text-[17px] leading-[1.7]">
        Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau
        alamatnya salah ketik.
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <Button
          asChild
          variant="outline"
          className="border-ink h-auto rounded-[8px] bg-transparent px-[18px] py-[9px] text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
        <Link
          href="/cari"
          className="border-ink border-b pb-0.5 text-[13.5px] font-medium"
        >
          Cari artikel
        </Link>
      </div>
    </Container>
  );
}
