import type { ArticleDetail } from '@/lib/api/types';
import { getSite } from '@/lib/api/queries';
import { absoluteUrl } from '@/lib/site-url';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { ImageBox } from '@/components/ui/ImageBox';
import { JsonLd } from '@/components/ui/JsonLd';
import { Prose } from '@/components/ui/Prose';
import { TagChip } from '@/components/ui/TagChip';
import { ArticleHeader } from './ArticleHeader';
import { ArticleSidebar } from './ArticleSidebar';
import { AuthorBox } from './AuthorBox';
import { EventInfoBox } from './EventInfoBox';
import { PreviewBanner } from './PreviewBanner';
import { RelatedArticles } from './RelatedArticles';
import { ShareButtons } from './ShareButtons';
import { ViewTracker } from './ViewTracker';

function breadcrumbItems(article: ArticleDetail) {
  const items: { label: string; href?: string }[] = [
    { label: 'Beranda', href: '/' },
  ];
  if (article.category.parent) {
    items.push({
      label: article.category.parent.name,
      href: `/${article.category.parent.slug}`,
    });
    items.push({
      label: article.category.name,
      href: `/${article.category.parent.slug}?sub=${article.category.slug}`,
    });
  } else {
    items.push({
      label: article.category.name,
      href: `/${article.category.slug}`,
    });
  }
  return items;
}

type ArticleViewProps = {
  article: ArticleDetail;
  /** True on the preview route: shows the banner and skips the view beacon. */
  preview?: boolean;
};

/**
 * Full article detail layout shared by the published route and the preview
 * route (doc 06 §5): breadcrumb, header, cover, body, tags, share, author box,
 * related articles, and a desktop Trending/Populer sidebar.
 */
export async function ArticleView({
  article,
  preview = false,
}: ArticleViewProps) {
  const site = await getSite();
  const identity = site.settings['site.identity'];
  const siteName = identity?.name ?? 'ALMAIDAH';
  const publisherLogoUrl = identity?.logo
    ? absoluteUrl(identity.logo.url)
    : absoluteUrl('/brand/logo.png');

  // NewsArticle requires `image`: same chain as generateMetadata's OG image
  // (article og, cover, site default OG), then the site logo as last resort.
  const imageMedia =
    article.seo.og ??
    article.cover ??
    site.settings['seo.defaults']?.default_og_media;
  const newsArticleImageUrl = imageMedia
    ? absoluteUrl(imageMedia.url)
    : publisherLogoUrl;

  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    ...(article.seo.description
      ? { description: article.seo.description }
      : {}),
    image: [newsArticleImageUrl],
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    dateModified: article.updated_at,
    author: {
      '@type': 'Person',
      name: article.author.display_name,
      url: absoluteUrl(`/penulis/${article.author.slug}`),
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: publisherLogoUrl,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.seo.canonical_url },
    articleSection: article.category.name,
    ...(article.tags.length
      ? { keywords: article.tags.map((tag) => tag.name).join(', ') }
      : {}),
    inLanguage: 'id',
    isAccessibleForFree: true,
  };

  return (
    <Container className="py-12 lg:py-16">
      <JsonLd data={newsArticleJsonLd} />
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {preview ? <PreviewBanner /> : null}
          <Breadcrumb items={breadcrumbItems(article)} />
          <div className="mt-6">
            <ArticleHeader article={article} />
          </div>
          <div className="mb-10">
            <ImageBox
              media={article.cover}
              ratio="16/9"
              sizes="(min-width: 1024px) 66vw, 100vw"
              alt={article.title}
              className="mb-3"
              preload
              fallbackLabel={`Foto utama — ${article.title}`}
            />
            {article.cover_caption ? (
              <p className="text-meta text-[13.5px] leading-[1.4]">
                {article.cover_caption}
              </p>
            ) : null}
          </div>
          <EventInfoBox article={article} />
          <Prose html={article.content_html} />
          {article.tags.length ? (
            <div className="mt-10 flex flex-wrap gap-2.5">
              {article.tags.map((tag) => (
                <TagChip key={tag.id} href={tag.url}>
                  {tag.name}
                </TagChip>
              ))}
            </div>
          ) : null}
          <div className="border-line mt-10 border-y py-6">
            <ShareButtons
              url={article.seo.canonical_url}
              title={article.title}
            />
          </div>
          <div className="mt-10">
            <AuthorBox author={article.author} />
          </div>
          <RelatedArticles items={article.related} />
          {!preview ? <ViewTracker articleId={article.id} /> : null}
        </div>
        <ArticleSidebar />
      </div>
    </Container>
  );
}
