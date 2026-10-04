'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/shadcn/breadcrumb';

import { breadcrumbFor } from './nav';

/** Topbar trail derived from the pathname and the nav tree. */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? (
                <BreadcrumbSeparator
                  className={last ? undefined : 'hidden sm:block'}
                />
              ) : null}
              <BreadcrumbItem
                className={last ? 'min-w-0' : 'hidden sm:inline-flex'}
              >
                {last ? (
                  <BreadcrumbPage className="truncate font-medium">
                    {c.label}
                  </BreadcrumbPage>
                ) : c.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{c.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
