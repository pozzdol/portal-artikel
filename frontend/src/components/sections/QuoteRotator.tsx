import type {
  QuoteRotatorConfig,
  QuoteRotatorData,
  SectionProps,
} from '@/lib/sections/types';

import { QuoteRotatorClient } from './QuoteRotatorClient';
import { SectionShell } from './SectionShell';

/** Full-bleed ink section rotating through short inspirational quotes. */
export function QuoteRotatorSection({
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<QuoteRotatorConfig, QuoteRotatorData>) {
  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background ?? 'ink'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabel="Kutipan inspiratif"
      py="py-[110px]"
    >
      <div className="mx-auto max-w-[900px] text-center">
        <QuoteRotatorClient
          quotes={data.quotes}
          intervalSeconds={config.interval_seconds}
          order={config.order}
        />
      </div>
    </SectionShell>
  );
}
