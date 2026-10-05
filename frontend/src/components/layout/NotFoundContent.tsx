import Link from 'next/link';
import { SearchBox } from '@/components/listing/SearchBox';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/shadcn/button';
import { TagChip } from '@/components/ui/TagChip';
import { getPopularTags } from '@/lib/api/queries';
import type { TagItem } from '@/lib/api/types';

export async function NotFoundContent() {
  let tags: TagItem[] = [];
  try {
    tags = await getPopularTags(8);
  } catch {
    // Popular topics are a nicety; the 404 page must render without them.
  }

  return (
    <Container className="flex flex-col items-start gap-6 py-16 sm:py-24">
      <h1 className="font-serif text-[36px] leading-[1.12] font-semibold tracking-[-0.01em] lg:text-[52px]">
        404 — Halaman tidak ditemukan
      </h1>
      <p className="text-soft max-w-[560px] text-[17px] leading-[1.7]">
        Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau
        alamatnya salah ketik.
      </p>
      <div className="w-full max-w-[560px]">
        <SearchBox />
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-meta text-[13px] font-medium">Topik populer</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip key={tag.id} href={`/tag/${tag.slug}`}>
                {tag.name}
              </TagChip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          variant="outline"
          className="border-ink min-h-11 rounded-[8px] bg-transparent px-[18px] text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-ink min-h-11 rounded-[8px] bg-transparent px-[18px] text-[13px] font-medium shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          <Link href="/cari">Cari artikel</Link>
        </Button>
      </div>
    </Container>
  );
}
