import Link from 'next/link';

import { getPopular, getTrending } from '@/lib/api/queries';
import { ArticleCard } from '@/components/cards/ArticleCard';
import { WidgetHeading } from '@/components/ui/WidgetHeading';

/** Desktop sidebar: Trending + Populer widgets, reused from the homepage data (doc 06 §5 item 11). */
export async function ArticleSidebar() {
  const [trending, popular] = await Promise.all([
    getTrending('day', 5),
    getPopular(30, 5),
  ]);

  if (!trending.length && !popular.length) return null;

  return (
    <aside className="flex flex-col gap-11">
      {trending.length ? (
        <div>
          <WidgetHeading as="h2">Trending Hari Ini</WidgetHeading>
          <div className="flex flex-col gap-5">
            {trending.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="trending"
                index={index + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
      {popular.length ? (
        <div>
          <WidgetHeading as="h2">Artikel Populer</WidgetHeading>
          <div className="flex flex-col gap-3">
            {popular.map((article, index) => (
              <Link
                key={article.id}
                href={article.url}
                className="text-ink text-[14px] leading-[1.4] font-medium hover:underline"
              >
                {index + 1}. {article.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
