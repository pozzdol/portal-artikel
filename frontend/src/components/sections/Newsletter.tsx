import type {
  NewsletterConfig,
  NewsletterData,
  SectionProps,
} from '@/lib/sections/types';

import { NewsletterForm } from './NewsletterForm';
import { SectionShell } from './SectionShell';

/** Full-bleed ink section closing the homepage; never empty. */
export function NewsletterSection({
  id,
  config,
  padTop,
  isFirst,
}: SectionProps<NewsletterConfig, NewsletterData>) {
  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background ?? 'ink'}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={headingId}
    >
      <div className="mx-auto max-w-[640px] text-center">
        <h2
          id={headingId}
          className="text-on-ink mb-3.5 font-serif text-[36px] font-semibold"
        >
          {config.title ?? 'Ikuti Kabar Terbaru ALMAIDAH'}
        </h2>
        <p className="text-on-ink-muted mb-8 text-[15px] leading-[1.7]">
          {config.description ??
            'Dapatkan kajian, berita, dan agenda alumni langsung ke surel Anda setiap pekan.'}
        </p>
        <NewsletterForm
          buttonLabel={config.button_label}
          placeholder={config.placeholder}
        />
      </div>
    </SectionShell>
  );
}
