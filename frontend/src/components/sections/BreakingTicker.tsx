import type {
  BreakingTickerConfig,
  BreakingTickerData,
  SectionProps,
} from '@/lib/sections/types';

import { Marquee } from './Marquee';
import { SectionShell } from './SectionShell';

/** Full-bleed ink bar with a gold "Breaking" badge and a scrolling ticker. */
export function BreakingTickerSection({
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<BreakingTickerConfig, BreakingTickerData>) {
  return (
    <SectionShell
      background={config.background ?? 'ink'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabel={config.label || 'Berita berjalan'}
      py="py-2.5 sm:py-3.5"
    >
      <div className="flex items-center gap-[18px]">
        <span className="bg-gold text-on-gold flex-none rounded-[4px] px-3 py-1.5 text-[12px] font-bold tracking-[0.08em] uppercase">
          {config.label}
        </span>
        <Marquee items={data.items} speedSeconds={config.speed_seconds} />
      </div>
    </SectionShell>
  );
}
