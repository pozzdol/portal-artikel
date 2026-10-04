import type { SectionType } from '@/lib/api/types';

// Props every homepage section component receives from SectionRenderer.
// Per-type Config/Data shapes live in @/lib/api/types and are re-exported here
// so section components import from one place.

export type SectionProps<C, D> = {
  id: number;
  config: C;
  data: D;
  /** True when the previously rendered section was an ink (full-bleed dark) section. */
  padTop: boolean;
  isFirst: boolean;
};

export type { SectionType };

export type {
  SectionBackground,
  SectionCommon,
  DedupeOptions,
  HeroTrendingConfig,
  HeroTrendingData,
  BreakingTickerConfig,
  BreakingTickerData,
  ArticleGridConfig,
  ArticleListData,
  CategoryWidgetItem,
  TagWidgetItem,
  SidebarWidget,
  LatestWithSidebarConfig,
  LatestWithSidebarData,
  QuoteRotatorConfig,
  QuoteRotatorData,
  TimelineConfig,
  FeatureSplitConfig,
  FeatureSplitData,
  PeopleGridConfig,
  PeopleGridData,
  AgendaCalendarConfig,
  AgendaCalendarData,
  CalendarDay,
  VideoGalleryConfig,
  VideoGalleryData,
  FaqConfig,
  FaqData,
  NewsletterConfig,
  NewsletterData,
  RichTextConfig,
  RichTextData,
  ResolvedSection,
  HomepagePayload,
} from '@/lib/api/types';
