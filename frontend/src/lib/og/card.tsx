import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from 'next/og';
import sharp from 'sharp';

// Branded 1200×630 share cards rendered with next/og (Satori: flexbox and
// inline styles only). Fonts and the crest are vendored in assets/og because
// next/font files are not readable at request time.

export const OG_SIZE = { width: 1200, height: 630 } as const;

const PHOTO_WIDTH = 520;
const ASSET_DIR = path.join(process.cwd(), 'assets', 'og');
const API_ORIGIN = (
  process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080'
).replace(/\/+$/, '');

const INK = '#111111';
const PAPER = '#ffffff';
const GOLD = '#c9a227';
const GOLD_STRONG = '#8a6d12';
const SOFT = '#555555';
const SOFT_ON_INK = '#b5b5b5';

export type OgCard = {
  /** Short context line above the title, e.g. the category name. */
  kicker?: string | null;
  title: string;
  /** Up to two short facts under the title (author, date, place). */
  meta?: (string | null | undefined)[];
  /** Relative /uploads/… path or a YouTube thumbnail URL. */
  image?: string | null;
};

type Assets = {
  fonts: { name: string; data: Buffer; weight: 500 | 600; style: 'normal' }[];
  logo: string;
};

let assetsPromise: Promise<Assets> | null = null;

function loadAssets(): Promise<Assets> {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async (): Promise<Assets> => {
    const [serif, sansMedium, sansSemi, logo] = await Promise.all([
      readFile(path.join(ASSET_DIR, 'CormorantGaramond-SemiBold.ttf')),
      readFile(path.join(ASSET_DIR, 'Inter-Medium.ttf')),
      readFile(path.join(ASSET_DIR, 'Inter-SemiBold.ttf')),
      readFile(path.join(ASSET_DIR, 'logo.png')),
    ]);
    return {
      fonts: [
        {
          name: 'Cormorant',
          data: serif,
          weight: 600 as const,
          style: 'normal' as const,
        },
        {
          name: 'Inter',
          data: sansMedium,
          weight: 500 as const,
          style: 'normal' as const,
        },
        {
          name: 'Inter',
          data: sansSemi,
          weight: 600 as const,
          style: 'normal' as const,
        },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    };
  })().catch((err) => {
    assetsPromise = null;
    throw err;
  });
  return assetsPromise;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Loads a cover from Go (/uploads) or YouTube and returns it as a JPEG data
 * URI cropped to the photo panel. Satori cannot decode WebP, and only these
 * two sources are accepted so the endpoint never fetches arbitrary URLs.
 */
async function loadPhoto(src: string): Promise<string | null> {
  let input: Buffer | null = null;
  let letterboxed = false;
  const yt = src.match(/^https:\/\/i\.ytimg\.com\/vi\/([\w-]{6,20})\//);
  if (src.startsWith('/uploads/')) {
    input = await fetchImage(`${API_ORIGIN}${src}`);
  } else if (yt) {
    // maxresdefault is 16:9 but missing for some videos; hqdefault is 4:3
    // with black bars around a 16:9 frame, which are cut off below.
    input = await fetchImage(
      `https://i.ytimg.com/vi/${yt[1]}/maxresdefault.jpg`,
    );
    if (!input) {
      input = await fetchImage(src);
      letterboxed = /\/hqdefault\.jpg$/.test(src);
    }
  }
  if (!input) return null;

  try {
    let img = sharp(input);
    if (letterboxed) {
      const { width = 480, height = 360 } = await img.metadata();
      const band = Math.round(height * 0.125);
      img = sharp(
        await img
          .extract({ left: 0, top: band, width, height: height - 2 * band })
          .toBuffer(),
      );
    }
    const jpeg = await img
      .resize(PHOTO_WIDTH, OG_SIZE.height, {
        fit: 'cover',
        position: 'attention',
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** Title size steps down with length so long headlines still fit in 4 lines. */
function titleSize(title: string, withPhoto: boolean): number {
  const n = title.length;
  if (withPhoto) return n <= 45 ? 66 : n <= 80 ? 56 : 48;
  return n <= 45 ? 84 : n <= 80 ? 70 : 58;
}

function Brand({
  logo,
  siteName,
  dark,
}: {
  logo: string;
  siteName: string;
  dark: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={62} height={58} />
      <div
        style={{
          fontFamily: 'Cormorant',
          fontSize: 36,
          letterSpacing: 2,
          color: dark ? PAPER : INK,
        }}
      >
        {siteName}
      </div>
    </div>
  );
}

function Meta({ items, dark }: { items: string[]; dark: boolean }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 16,
        rowGap: 6,
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: 24,
        color: dark ? SOFT_ON_INK : SOFT,
      }}
    >
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {i > 0 ? (
            <div style={{ width: 7, height: 7, background: GOLD }} />
          ) : null}
          <div style={{ display: 'flex' }}>{item}</div>
        </div>
      ))}
    </div>
  );
}

/** Renders a content card: photo panel on the right when an image is available, ink card otherwise. */
export async function renderCard(
  card: OgCard,
  siteName: string,
): Promise<ImageResponse> {
  const [{ fonts, logo }, photo] = await Promise.all([
    loadAssets(),
    card.image ? loadPhoto(card.image) : Promise.resolve(null),
  ]);
  const dark = !photo;
  const title = clip(card.title, photo ? 130 : 150);
  const meta = (card.meta ?? [])
    .filter((m): m is string => Boolean(m && m.trim()))
    .slice(0, 2)
    .map((m) => clip(m, 40));
  const size = titleSize(title, Boolean(photo));

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: dark ? INK : PAPER,
      }}
    >
      <div style={{ width: 12, height: '100%', background: GOLD }} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: photo ? '56px 56px 52px 60px' : '60px 88px 56px 80px',
        }}
      >
        <Brand logo={logo} siteName={siteName} dark={dark} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {card.kicker ? (
            <div
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: 26,
                color: dark ? GOLD : GOLD_STRONG,
              }}
            >
              {clip(card.kicker, 40)}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: 'Cormorant',
              fontSize: size,
              lineHeight: 1.06,
              color: dark ? PAPER : INK,
              lineClamp: 4,
              display: 'block',
            }}
          >
            {title}
          </div>
        </div>
        <Meta items={meta} dark={dark} />
      </div>
      {photo ? (
        <div style={{ display: 'flex', width: PHOTO_WIDTH, height: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={photo} width={PHOTO_WIDTH} height={OG_SIZE.height} />
        </div>
      ) : null}
    </div>,
    { ...OG_SIZE, fonts },
  );
}

/** Renders the site-wide card used for the homepage and listing pages. */
export async function renderSiteCard(
  siteName: string,
  tagline: string,
  host: string,
): Promise<ImageResponse> {
  const { fonts, logo } = await loadAssets();
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: INK,
        padding: '0 96px',
        gap: 72,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={288} height={268} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            fontFamily: 'Cormorant',
            fontSize: 120,
            lineHeight: 1,
            letterSpacing: 6,
            color: PAPER,
          }}
        >
          {siteName}
        </div>
        <div
          style={{
            width: 96,
            height: 6,
            background: GOLD,
            margin: '30px 0 28px',
          }}
        />
        <div
          style={{
            fontFamily: 'Cormorant',
            fontSize: 46,
            lineHeight: 1.15,
            color: SOFT_ON_INK,
          }}
        >
          {clip(tagline, 80)}
        </div>
        <div
          style={{
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: 24,
            color: GOLD,
            marginTop: 40,
          }}
        >
          {host}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
