import Link from 'next/link';

import { Eyebrow } from '@/components/ui/Eyebrow';
import type { FaqConfig, FaqData, SectionProps } from '@/lib/sections/types';

import { FaqAccordion } from './FaqAccordion';
import { SectionShell } from './SectionShell';

/** "Pertanyaan Umum": a 30px heading (below the standard `SectionHeading` scale) + `FaqAccordion`. */
export function FaqSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<FaqConfig, FaqData>) {
  if (data.items.length === 0) return null;

  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={headingId}
    >
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          {config.eyebrow ? (
            <Eyebrow size="md" className="mb-2">
              {config.eyebrow}
            </Eyebrow>
          ) : null}
          <h2
            id={headingId}
            className="text-ink font-serif text-[30px] font-semibold"
          >
            {config.title ?? 'Pertanyaan Umum'}
          </h2>
        </div>
        {config.more_link ? (
          <Link
            href={config.more_link.href}
            className="border-ink text-ink border-b pb-0.5 text-[13.5px] font-medium whitespace-nowrap"
          >
            {config.more_link.label} →
          </Link>
        ) : null}
      </div>
      <FaqAccordion
        items={data.items}
        defaultOpenIndex={config.default_open_index}
      />
    </SectionShell>
  );
}
