import type { Metadata } from 'next';

import { VideoGrid } from '@/components/video/VideoGrid';
import { YouTubeEmbed } from '@/components/video/YouTubeEmbed';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { JsonLd } from '@/components/ui/JsonLd';
import { getVideo } from '@/lib/api/queries';
import { formatCompactNumber, formatDateLong } from '@/lib/format';
import { absoluteUrl } from '@/lib/site-url';

export async function generateMetadata(
  props: PageProps<'/video/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const video = await getVideo(slug);
  const description = video.description ?? video.title;
  const canonical = absoluteUrl(video.url);
  const thumbnail = /^https?:\/\//i.test(video.thumbnail_url)
    ? video.thumbnail_url
    : absoluteUrl(video.thumbnail_url);

  return {
    title: video.title,
    description,
    alternates: {
      canonical,
      types: { 'application/rss+xml': absoluteUrl('/feed.xml') },
    },
    openGraph: {
      title: video.title,
      description,
      type: 'video.other',
      url: canonical,
      images: [thumbnail],
    },
    twitter: { card: 'summary_large_image' },
  };
}

/** Seconds -> ISO 8601 duration ("PT18M24S"), for the VideoObject JSON-LD only. */
function isoDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${secs || (!hours && !minutes) ? `${secs}S` : ''}`;
}

export default async function VideoDetailPage(
  props: PageProps<'/video/[slug]'>,
) {
  const { slug } = await props.params;
  const video = await getVideo(slug);
  const thumbnail = /^https?:\/\//i.test(video.thumbnail_url)
    ? video.thumbnail_url
    : absoluteUrl(video.thumbnail_url);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description ?? video.title,
    thumbnailUrl: [thumbnail],
    uploadDate: video.published_at,
    duration: video.duration_seconds
      ? isoDuration(video.duration_seconds)
      : undefined,
    embedUrl: video.embed_url,
    ...(video.view_count !== null
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/WatchAction',
            userInteractionCount: video.view_count,
          },
        }
      : {}),
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-[840px]">
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Video', href: '/video' },
            { label: video.title },
          ]}
        />
        <div className="mt-5 sm:mt-6" />
        <Eyebrow size="md" className="mb-3">
          Video
        </Eyebrow>
        <h1 className="text-ink font-serif text-[32px] leading-[1.12] font-semibold tracking-[-0.01em] sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">
          {video.title}
        </h1>
        <div className="text-faint mt-4 text-[12.5px] font-medium">
          {video.view_count !== null
            ? `${formatCompactNumber(video.view_count)} ditonton · `
            : null}
          {formatDateLong(video.published_at)}
        </div>

        <div className="mt-8">
          <YouTubeEmbed
            embedUrl={video.embed_url}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
          />
        </div>

        {video.description ? (
          <p className="text-soft mt-8 max-w-[720px] text-[15px] leading-[1.7] whitespace-pre-line">
            {video.description}
          </p>
        ) : null}
      </div>

      {video.others.length > 0 ? (
        <div className="mx-auto mt-16 max-w-[1120px]">
          <h2 className="border-line text-ink mb-8 border-b pb-4 font-serif text-[28px] font-semibold">
            Video Lainnya
          </h2>
          <VideoGrid videos={video.others} />
        </div>
      ) : null}
    </Container>
  );
}

// ISR for all paths at runtime: nothing prebuilt, each slug cached on first visit (Next 16 generateStaticParams docs).
export function generateStaticParams() {
  return [];
}
