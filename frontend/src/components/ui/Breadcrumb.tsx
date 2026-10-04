import Link from 'next/link';
import { Fragment } from 'react';

import { absoluteUrl } from '@/lib/site-url';
import { JsonLd } from '@/components/ui/JsonLd';
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/shadcn/breadcrumb';

type BreadcrumbItemData = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItemData[];
};

/** Breadcrumb trail with a gold `/` separator and a matching `BreadcrumbList` JSON-LD block. */
export function Breadcrumb({ items }: BreadcrumbProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BreadcrumbRoot>
        <BreadcrumbList className="text-faint flex-wrap gap-2 text-[12.5px] font-medium sm:gap-2">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 ? (
                  <BreadcrumbSeparator>
                    <span aria-hidden="true" className="text-gold">
                      /
                    </span>
                  </BreadcrumbSeparator>
                ) : null}
                <BreadcrumbItem>
                  {!isLast && item.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className={cnLast(isLast)}>
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </BreadcrumbRoot>
    </>
  );
}

/** `BreadcrumbPage` defaults to `font-normal text-foreground`; restore the
 * trail's own weight and only color the final crumb ink (others stay faint). */
function cnLast(isLast: boolean): string {
  return isLast ? 'font-medium text-ink' : 'font-medium text-faint';
}
