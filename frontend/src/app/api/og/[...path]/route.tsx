import sharp from 'sharp';

import {
  getAlumni,
  getArticle,
  getAuthor,
  getCategory,
  getEvent,
  getPage,
  getSite,
  getTag,
  getVideo,
} from '@/lib/api/queries';
import { formatWib } from '@/lib/datetime';
import { renderCard, renderSiteCard, type OgCard } from '@/lib/og/card';
import { SITE_URL } from '@/lib/site-url';

// GET /api/og/{kind}/{slug}.jpg and /api/og/situs.jpg — branded share images
// referenced from generateMetadata (lib/og/meta.ts). Satori's PNG is re-encoded
// as JPEG because cards with photos exceed 400 KB as PNG and WhatsApp drops
// large previews. The .jpg suffix lets the CDN cache them by extension; the
// ?v= query only busts caches after edits.
// Any lookup failure (unknown slug, API down) falls back to the site card so a
// shared link never shows a broken preview.

const CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

function date(input: string | null | undefined): string | null {
  return input ? formatWib(input, 'd MMMM yyyy') : null;
}

async function loadArticle(slug: string): Promise<OgCard> {
  let result = await getArticle(slug);
  if (result.kind === 'redirect') {
    result = await getArticle(result.to.split('/').pop() ?? slug);
  }
  if (result.kind === 'redirect') throw new Error('redirect loop');
  const a = result.article;
  return {
    kicker: a.category.name,
    title: a.title,
    meta: [a.author.display_name, date(a.published_at)],
    image: a.cover?.url,
  };
}

const loaders: Record<string, (slug: string) => Promise<OgCard>> = {
  artikel: loadArticle,
  async video(slug) {
    const v = await getVideo(slug);
    return {
      kicker: 'Video',
      title: v.title,
      meta: [date(v.published_at)],
      image: v.thumbnail_url,
    };
  },
  async agenda(slug) {
    const e = await getEvent(slug);
    const when = e.is_all_day
      ? formatWib(e.starts_at, 'EEEE, d MMMM yyyy')
      : formatWib(e.starts_at, "EEEE, d MMMM yyyy, HH.mm 'WIB'");
    return {
      kicker: e.status === 'cancelled' ? 'Agenda dibatalkan' : 'Agenda',
      title: e.title,
      meta: [when, e.location_name],
      image: e.cover?.url,
    };
  },
  async tokoh(slug) {
    const p = await getAlumni(slug);
    return {
      kicker: 'Tokoh alumni',
      title: p.name,
      meta: [p.role_title, p.class_year ? `Angkatan ${p.class_year}` : null],
      image: p.photo?.url,
    };
  },
  async penulis(slug) {
    const a = await getAuthor(slug);
    return {
      kicker: 'Penulis',
      title: a.display_name,
      meta: [a.title],
      image: a.avatar?.url,
    };
  },
  async halaman(slug) {
    const p = await getPage(slug);
    return { title: p.title };
  },
  async kategori(slug) {
    const c = await getCategory(slug);
    return {
      kicker: 'Rubrik',
      title: c.name,
      meta: [c.article_count > 0 ? `${c.article_count} tulisan` : null],
    };
  },
  async tag(slug) {
    const t = await getTag(slug);
    return {
      kicker: 'Topik',
      title: t.name,
      meta: [t.article_count > 0 ? `${t.article_count} tulisan` : null],
    };
  },
};

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/og/[...path]'>,
) {
  const { path } = await ctx.params;
  const site = await getSite().catch(() => null);
  const identity = site?.settings['site.identity'];
  const siteName = identity?.name ?? 'ALMAIDAH';

  let png: Response | null = null;
  if (path.length === 2) {
    const load = loaders[path[0]];
    const slug = path[1].replace(/\.jpg$/, '');
    if (load && slug) {
      try {
        png = await renderCard(await load(slug), siteName);
      } catch {
        png = null;
      }
    }
  }
  png ??= await renderSiteCard(
    siteName,
    identity?.tagline ?? 'Alumni Darul Hikmah Sumedang',
    new URL(SITE_URL).host,
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE_CONTROL },
  });
}
