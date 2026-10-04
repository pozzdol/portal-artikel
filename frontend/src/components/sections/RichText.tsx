import { Prose } from '@/components/ui/Prose';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { cn } from '@/lib/cn';
import type {
  RichTextConfig,
  RichTextData,
  SectionProps,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

const MAX_WIDTH_CLASS: Record<RichTextConfig['max_width'], string> = {
  prose: 'max-w-[720px]',
  wide: 'max-w-[960px]',
  full: 'max-w-none',
};

const ALIGN_CLASS: Record<RichTextConfig['align'], string> = {
  left: '',
  center: 'mx-auto text-center',
  right: 'ml-auto text-right',
};

/** Free-form sanitized rich text block (used on inner pages; no homepage reference in the design). */
export function RichTextSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<RichTextConfig, RichTextData>) {
  if (!data.content_html.trim()) return null;

  const headingId = config.anchor_id
    ? `${config.anchor_id}-h2`
    : `section-${id}-h2`;

  return (
    <SectionShell
      anchorId={config.anchor_id}
      background={config.background}
      padTop={padTop}
      isFirst={isFirst}
      ariaLabelledBy={config.title ? headingId : undefined}
    >
      {config.title ? (
        <SectionHeading
          id={headingId}
          title={config.title}
          eyebrow={config.eyebrow}
          moreLink={config.more_link}
        />
      ) : null}
      <Prose
        html={data.content_html}
        className={cn(
          MAX_WIDTH_CLASS[config.max_width],
          ALIGN_CLASS[config.align],
        )}
      />
    </SectionShell>
  );
}
