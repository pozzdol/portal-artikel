import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Eyebrow } from '@/components/ui/Eyebrow';

type SectionHeadingProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  moreLink?: { label: string; href: string };
  size?: 'lg' | 'md';
  divider?: boolean;
  className?: string;
};

const TITLE_SIZE: Record<NonNullable<SectionHeadingProps['size']>, string> = {
  lg: 'text-[34px]',
  md: 'text-[28px]',
};

/** Section title row: eyebrow + heading on the left, an optional "more" link on the right. */
export function SectionHeading({
  id,
  title,
  eyebrow,
  moreLink,
  size = 'lg',
  divider = true,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 sm:flex-row sm:items-baseline sm:justify-between',
        divider && 'border-line mb-7 border-b pb-4 sm:mb-11 sm:pb-5',
        !divider && 'mb-7 sm:mb-11',
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <Eyebrow size="md" className="mb-2">
            {eyebrow}
          </Eyebrow>
        ) : null}
        <h2
          id={id}
          className={cn(
            'text-ink font-serif leading-[1.2] font-semibold',
            TITLE_SIZE[size],
          )}
        >
          {title}
        </h2>
      </div>
      {moreLink ? (
        <Link
          href={moreLink.href}
          className="border-ink text-ink inline-flex min-h-11 w-full items-center justify-center border py-2.5 text-[13.5px] font-medium whitespace-nowrap sm:inline sm:min-h-0 sm:w-auto sm:border-0 sm:border-b sm:py-0 sm:pb-0.5"
        >
          {/(?:→|->)\s*$/.test(moreLink.label)
            ? moreLink.label
            : `${moreLink.label} →`}
        </Link>
      ) : null}
    </div>
  );
}
