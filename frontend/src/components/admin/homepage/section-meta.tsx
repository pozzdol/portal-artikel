import {
  CalendarDaysIcon,
  CircleHelpIcon,
  ClapperboardIcon,
  Columns2Icon,
  GitCommitVerticalIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  MailIcon,
  MegaphoneIcon,
  PanelRightIcon,
  QuoteIcon,
  TypeIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/cn';

export const SECTION_ICONS: Record<string, LucideIcon> = {
  hero_trending: LayoutTemplateIcon,
  breaking_ticker: MegaphoneIcon,
  article_grid: LayoutGridIcon,
  latest_with_sidebar: PanelRightIcon,
  quote_rotator: QuoteIcon,
  timeline: GitCommitVerticalIcon,
  feature_split: Columns2Icon,
  people_grid: UsersIcon,
  agenda_calendar: CalendarDaysIcon,
  video_gallery: ClapperboardIcon,
  faq: CircleHelpIcon,
  newsletter: MailIcon,
  rich_text: TypeIcon,
};

export function sectionIcon(type: string): LucideIcon {
  return SECTION_ICONS[type] ?? LayoutTemplateIcon;
}

// Thumbnails are drawn on a 96×60 grid. Blocks: image = faint, text = line
// strokes, accent = gold (mirrors the public design's gold markers).
const IMG = 'fill-faint';
const TXT = 'fill-meta/50';
const ACC = 'fill-gold';
const INK = 'fill-ink';
const SURFACE = 'fill-ink-surface';

function Lines({
  x,
  y,
  w,
  n,
  gap = 4,
}: {
  x: number;
  y: number;
  w: number;
  n: number;
  gap?: number;
}) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === n - 1 ? w * 0.6 : w}
          height={1.6}
          className={TXT}
        />
      ))}
    </>
  );
}

const THUMBS: Record<string, React.ReactNode> = {
  hero_trending: (
    <>
      <rect x={4} y={4} width={56} height={40} className={IMG} />
      <Lines x={4} y={48} w={50} n={2} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={66} y={6 + i * 13} width={4} height={4} className={ACC} />
          <Lines x={73} y={6 + i * 13} w={19} n={2} gap={3.5} />
        </g>
      ))}
    </>
  ),
  breaking_ticker: (
    <>
      <rect x={0} y={22} width={96} height={16} className={SURFACE} />
      <rect x={4} y={26} width={16} height={8} className={ACC} />
      <rect
        x={25}
        y={29.2}
        width={30}
        height={1.6}
        className="fill-on-ink/70"
      />
      <rect
        x={60}
        y={29.2}
        width={30}
        height={1.6}
        className="fill-on-ink/70"
      />
    </>
  ),
  article_grid: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 31} y={8} width={26} height={20} className={IMG} />
          <Lines x={4 + i * 31} y={32} w={24} n={3} />
        </g>
      ))}
    </>
  ),
  latest_with_sidebar: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4} y={6 + i * 17} width={18} height={13} className={IMG} />
          <Lines x={26} y={8 + i * 17} w={34} n={2} />
        </g>
      ))}
      <rect
        x={66}
        y={6}
        width={26}
        height={48}
        className="stroke-meta/40 fill-none"
        strokeWidth={1}
      />
      <rect x={70} y={10} width={10} height={2} className={ACC} />
      <Lines x={70} y={17} w={18} n={4} gap={4.5} />
      <rect x={70} y={38} width={10} height={2} className={ACC} />
      <Lines x={70} y={44} w={18} n={2} gap={4.5} />
    </>
  ),
  quote_rotator: (
    <>
      <rect x={0} y={0} width={96} height={60} className={SURFACE} />
      <text x={12} y={30} className="fill-gold font-serif" fontSize={22}>
        &ldquo;
      </text>
      <rect x={24} y={22} width={50} height={2} className="fill-on-ink/70" />
      <rect x={24} y={28} width={44} height={2} className="fill-on-ink/70" />
      <rect x={38} y={40} width={20} height={1.6} className={ACC} />
    </>
  ),
  timeline: (
    <>
      <rect x={12} y={4} width={1.5} height={52} className="fill-meta/40" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={12.75} cy={10 + i * 18} r={2.6} className={ACC} />
          <rect x={20} y={5 + i * 18} width={18} height={12} className={IMG} />
          <Lines x={42} y={7 + i * 18} w={46} n={2} />
        </g>
      ))}
    </>
  ),
  feature_split: (
    <>
      <rect x={4} y={4} width={50} height={32} className={IMG} />
      <rect x={4} y={40} width={14} height={2} className={ACC} />
      <Lines x={4} y={46} w={46} n={2} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={60} y={5 + i * 17} width={12} height={12} className={IMG} />
          <Lines x={75} y={7 + i * 17} w={17} n={2} />
        </g>
      ))}
    </>
  ),
  people_grid: (
    <>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={4 + i * 23} y={6} width={19} height={26} className={IMG} />
          <rect x={4 + i * 23} y={36} width={14} height={1.8} className={INK} />
          <rect x={4 + i * 23} y={41} width={10} height={1.6} className={ACC} />
          <Lines x={4 + i * 23} y={46} w={18} n={2} />
        </g>
      ))}
    </>
  ),
  agenda_calendar: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4} y={6 + i * 17} width={10} height={10} className={ACC} />
          <Lines x={18} y={8 + i * 17} w={30} n={2} />
        </g>
      ))}
      {Array.from({ length: 20 }, (_, i) => (
        <rect
          key={i}
          x={56 + (i % 5) * 7.4}
          y={10 + Math.floor(i / 5) * 11}
          width={5}
          height={5}
          className={i === 8 ? ACC : 'fill-meta/30'}
        />
      ))}
    </>
  ),
  video_gallery: (
    <>
      <rect x={4} y={6} width={54} height={36} className={IMG} />
      <path d="M26 17 L38 24 L26 31 Z" className={ACC} />
      <Lines x={4} y={46} w={48} n={2} />
      <rect x={62} y={6} width={30} height={18} className={IMG} />
      <rect x={62} y={28} width={30} height={18} className={IMG} />
      <Lines x={62} y={50} w={28} n={1} />
    </>
  ),
  faq: (
    <>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={4}
            y={6 + i * 13 + (i > 0 ? 8 : 0)}
            width={88}
            height={0.8}
            className="fill-meta/40"
          />
          <rect
            x={6}
            y={10 + i * 13 + (i > 0 ? 8 : 0)}
            width={46}
            height={1.8}
            className={INK}
          />
          <rect
            x={86}
            y={9.5 + i * 13 + (i > 0 ? 8 : 0)}
            width={4}
            height={1.6}
            className={ACC}
          />
        </g>
      ))}
      <Lines x={6} y={16} w={60} n={2} />
    </>
  ),
  newsletter: (
    <>
      <rect x={0} y={0} width={96} height={60} className={SURFACE} />
      <rect x={24} y={14} width={48} height={3} className="fill-on-ink/80" />
      <rect x={30} y={21} width={36} height={1.6} className="fill-on-ink/50" />
      <rect
        x={18}
        y={32}
        width={42}
        height={10}
        className="stroke-on-ink/50 fill-none"
        strokeWidth={1}
      />
      <rect x={62} y={32} width={16} height={10} className={ACC} />
    </>
  ),
  rich_text: (
    <>
      <rect x={16} y={8} width={40} height={3} className={INK} />
      <Lines x={16} y={17} w={64} n={4} gap={5} />
      <Lines x={16} y={40} w={64} n={3} gap={5} />
    </>
  ),
};

/** Small layout sketch of a section type (gallery cards, list rows). */
export function SectionThumbnail({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 60"
      aria-hidden="true"
      className={cn(
        'bg-paper border-line block aspect-[8/5] border',
        className,
      )}
    >
      {THUMBS[type] ?? <Lines x={8} y={10} w={80} n={6} gap={7} />}
    </svg>
  );
}
