import { PersonCard } from '@/components/cards/PersonCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { cn } from '@/lib/cn';
import type {
  PeopleGridConfig,
  PeopleGridData,
  SectionProps,
} from '@/lib/sections/types';

import { SectionShell } from './SectionShell';

/** "Tokoh Alumni": a grid of `PersonCard`, 3 or 4 columns per `config.columns`. */
export function PeopleGridSection({
  id,
  config,
  data,
  padTop,
  isFirst,
}: SectionProps<PeopleGridConfig, PeopleGridData>) {
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
      <SectionHeading
        id={headingId}
        title={config.title ?? 'Tokoh Alumni'}
        eyebrow={config.eyebrow}
        moreLink={config.more_link}
        divider={false}
      />
      <div
        className={cn(
          'grid grid-cols-1 gap-8 sm:grid-cols-2',
          config.columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        )}
      >
        {data.items.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            ctaLabel={config.cta_label}
          />
        ))}
      </div>
    </SectionShell>
  );
}
