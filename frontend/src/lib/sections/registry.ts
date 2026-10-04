import type { ComponentType } from 'react';

import { ArticleGridSection } from '@/components/sections/ArticleGrid';
import { AgendaCalendarSection } from '@/components/sections/AgendaCalendar';
import { BreakingTickerSection } from '@/components/sections/BreakingTicker';
import { FaqSection } from '@/components/sections/Faq';
import { FeatureSplitSection } from '@/components/sections/FeatureSplit';
import { HeroTrendingSection } from '@/components/sections/HeroTrending';
import { LatestWithSidebarSection } from '@/components/sections/LatestWithSidebar';
import { NewsletterSection } from '@/components/sections/Newsletter';
import { PeopleGridSection } from '@/components/sections/PeopleGrid';
import { QuoteRotatorSection } from '@/components/sections/QuoteRotator';
import { RichTextSection } from '@/components/sections/RichText';
import { TimelineSection } from '@/components/sections/Timeline';
import { VideoGallerySection } from '@/components/sections/VideoGallery';
import type {
  AgendaCalendarConfig,
  AgendaCalendarData,
  ArticleGridConfig,
  ArticleListData,
  BreakingTickerConfig,
  BreakingTickerData,
  FaqConfig,
  FaqData,
  FeatureSplitConfig,
  FeatureSplitData,
  HeroTrendingConfig,
  HeroTrendingData,
  LatestWithSidebarConfig,
  LatestWithSidebarData,
  NewsletterConfig,
  NewsletterData,
  PeopleGridConfig,
  PeopleGridData,
  QuoteRotatorConfig,
  QuoteRotatorData,
  RichTextConfig,
  RichTextData,
  SectionBackground,
  SectionProps,
  SectionType,
  TimelineConfig,
  VideoGalleryConfig,
  VideoGalleryData,
} from './types';

type RegistryEntry<C = never, D = never> = {
  Component: ComponentType<SectionProps<C, D>>;
  isEmpty: (data: D) => boolean;
  /**
   * Background this section renders with when `config.background` is unset,
   * mirroring the `config.background ?? '...'` fallback the component itself
   * applies. `SectionRenderer` needs this to compute inter-section spacing
   * (`padTop`) without re-deriving each component's own default.
   */
  defaultBackground?: SectionBackground;
};

/**
 * Maps every backend homepage section `type` (docs/03 §... homepage builder)
 * to its React component and an `isEmpty` rule used by `SectionRenderer` to
 * skip sections with nothing to show. Keys mirror `SectionType` exhaustively;
 * an unknown `type` from a future backend version is handled at the call site
 * in `SectionRenderer`, not here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry: each entry's real Config/Data types vary and are cast at the call site above.
export const sectionRegistry: Record<SectionType, RegistryEntry<any, any>> = {
  hero_trending: {
    Component: HeroTrendingSection as ComponentType<
      SectionProps<HeroTrendingConfig, HeroTrendingData>
    >,
    isEmpty: (data: HeroTrendingData) => !data.hero,
    defaultBackground: 'paper',
  },
  breaking_ticker: {
    Component: BreakingTickerSection as ComponentType<
      SectionProps<BreakingTickerConfig, BreakingTickerData>
    >,
    isEmpty: (data: BreakingTickerData) => data.items.length === 0,
    defaultBackground: 'ink',
  },
  article_grid: {
    Component: ArticleGridSection as ComponentType<
      SectionProps<ArticleGridConfig, ArticleListData>
    >,
    isEmpty: (data: ArticleListData) => data.items.length === 0,
    defaultBackground: 'paper',
  },
  latest_with_sidebar: {
    Component: LatestWithSidebarSection as ComponentType<
      SectionProps<LatestWithSidebarConfig, LatestWithSidebarData>
    >,
    isEmpty: (data: LatestWithSidebarData) => data.items.length === 0,
    defaultBackground: 'paper',
  },
  quote_rotator: {
    Component: QuoteRotatorSection as ComponentType<
      SectionProps<QuoteRotatorConfig, QuoteRotatorData>
    >,
    isEmpty: (data: QuoteRotatorData) => data.quotes.length === 0,
    defaultBackground: 'ink',
  },
  timeline: {
    Component: TimelineSection as ComponentType<
      SectionProps<TimelineConfig, ArticleListData>
    >,
    isEmpty: (data: ArticleListData) => data.items.length === 0,
  },
  feature_split: {
    Component: FeatureSplitSection as ComponentType<
      SectionProps<FeatureSplitConfig, FeatureSplitData>
    >,
    isEmpty: (data: FeatureSplitData) => !data.featured,
  },
  people_grid: {
    Component: PeopleGridSection as ComponentType<
      SectionProps<PeopleGridConfig, PeopleGridData>
    >,
    isEmpty: (data: PeopleGridData) => data.items.length === 0,
  },
  agenda_calendar: {
    Component: AgendaCalendarSection as ComponentType<
      SectionProps<AgendaCalendarConfig, AgendaCalendarData>
    >,
    isEmpty: (data: AgendaCalendarData) => data.items.length === 0,
  },
  video_gallery: {
    Component: VideoGallerySection as ComponentType<
      SectionProps<VideoGalleryConfig, VideoGalleryData>
    >,
    isEmpty: (data: VideoGalleryData) => data.items.length === 0,
  },
  faq: {
    Component: FaqSection as ComponentType<SectionProps<FaqConfig, FaqData>>,
    isEmpty: (data: FaqData) => data.items.length === 0,
  },
  newsletter: {
    Component: NewsletterSection as ComponentType<
      SectionProps<NewsletterConfig, NewsletterData>
    >,
    isEmpty: () => false,
    defaultBackground: 'ink',
  },
  rich_text: {
    Component: RichTextSection as ComponentType<
      SectionProps<RichTextConfig, RichTextData>
    >,
    isEmpty: (data: RichTextData) => !data.content_html.trim(),
  },
};
