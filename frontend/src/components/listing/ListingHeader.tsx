import type { ReactNode } from 'react';

import { Eyebrow } from '@/components/ui/Eyebrow';

type ListingHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string | null;
  children?: ReactNode;
};

/** Listing/detail page header: eyebrow label, serif H1, optional description. */
export function ListingHeader({
  eyebrow,
  title,
  description,
  children,
}: ListingHeaderProps) {
  return (
    <header className="border-line mb-11 border-b pb-9">
      <Eyebrow size="md" className="mb-3.5">
        {eyebrow}
      </Eyebrow>
      <h1 className="text-ink mb-3.5 font-serif text-[36px] leading-[1.2] font-semibold lg:text-[44px]">
        {title}
      </h1>
      {description ? (
        <p className="text-soft max-w-[640px] text-[15px] leading-[1.7]">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}
