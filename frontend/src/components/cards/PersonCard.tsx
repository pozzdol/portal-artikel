import Link from 'next/link';
import type { ElementType } from 'react';

import type { AlumniCard } from '@/lib/api/types';
import { ImageBox } from '@/components/ui/ImageBox';

type PersonCardProps = {
  person: AlumniCard;
  ctaLabel?: string;
  /** 'h2' when rendered directly under the page h1 (the `/tokoh` listing);
   *  default 'h3' when a section h2 already precedes it (homepage). */
  headingLevel?: 'h2' | 'h3';
};

/** Centered alumni profile card: photo, name, role, short bio, "Baca Kisah" CTA. */
export function PersonCard({
  person,
  ctaLabel = 'Baca Kisah',
  headingLevel,
}: PersonCardProps) {
  const HeadingTag = (headingLevel ?? 'h3') as ElementType;
  return (
    <div className="text-center">
      <ImageBox
        media={person.photo}
        ratio="3/4"
        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
        alt={person.name}
        className="mb-[18px] aspect-[4/5]"
        imgClassName="object-top"
      />
      <HeadingTag className="text-ink mb-1 font-serif text-[18px] font-semibold sm:text-[20px]">
        {person.name}
      </HeadingTag>
      <div className="text-gold-strong mb-2.5 text-[12.5px] font-medium">
        {person.role_title}
      </div>
      <p className="text-meta mb-3.5 line-clamp-3 text-[13px] leading-[1.6] sm:text-[13.5px]">
        {person.short_bio}
      </p>
      <Link
        href={person.url}
        className="border-gold text-ink inline-flex min-h-11 items-center border-b pb-0.5 text-[12.5px] font-semibold lg:min-h-0"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
