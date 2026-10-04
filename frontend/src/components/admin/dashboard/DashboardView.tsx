'use client';

import Link from 'next/link';
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  EyeIcon,
  FileEditIcon,
  MapPinIcon,
  NewspaperIcon,
  PenLineIcon,
  TrophyIcon,
} from 'lucide-react';

import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn/card';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { useDashboard } from '@/lib/api/admin/dashboard';
import type { ArticleStatus } from '@/lib/api/admin/types';
import { formatWib, relativeWib } from '@/lib/datetime';

import { ViewsChart } from './ViewsChart';

type StatDef = { label: string; value: number; icon: typeof NewspaperIcon };

function StatCards({
  articles,
  views7d,
}: {
  articles: { published: number; draft: number; scheduled: number };
  views7d: number;
}) {
  const stats: StatDef[] = [
    { label: 'Artikel terbit', value: articles.published, icon: NewspaperIcon },
    { label: 'Draf', value: articles.draft, icon: FileEditIcon },
    { label: 'Terjadwal', value: articles.scheduled, icon: CalendarClockIcon },
    { label: 'Kunjungan 7 hari', value: views7d, icon: EyeIcon },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center">
              <s.icon className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-2xl leading-none font-medium">
                {s.value.toLocaleString('id-ID')}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                {s.label}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 py-5">
            <Skeleton className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Admin landing page: content counters, a 14-day views chart, and quick jumping-off points. */
export function DashboardView() {
  const { data, isLoading } = useDashboard();
  const canWriteArticles = usePermission('articles.create');
  const canWriteEvents = usePermission('events.manage');

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dasbor"
        description="Ringkasan konten dan kunjungan tujuh hari terakhir."
        actions={
          <>
            {canWriteArticles ? (
              <Button asChild variant="gold">
                <Link href="/admin/articles/new">
                  <PenLineIcon data-icon="inline-start" />
                  Tulis Artikel
                </Link>
              </Button>
            ) : null}
            {canWriteEvents ? (
              <Button asChild variant="outline">
                <Link href="/admin/events/new">
                  <CalendarPlusIcon data-icon="inline-start" />
                  Tambah Agenda
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading || !data ? (
        <>
          <StatCardsSkeleton />
          <Skeleton className="h-[300px] w-full" />
        </>
      ) : (
        <>
          <StatCards articles={data.articles} views7d={data.views_7d} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Kunjungan 14 hari terakhir</CardTitle>
                <CardDescription>
                  Jumlah tampilan artikel per hari (WIB).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ViewsChart data={data.views_daily} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrophyIcon className="text-gold size-4" aria-hidden />
                  Teratas minggu ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.top_week.length === 0 ? (
                  <EmptyState
                    title="Belum ada data"
                    description="Belum ada kunjungan artikel minggu ini."
                  />
                ) : (
                  <ol className="flex flex-col gap-3">
                    {data.top_week.map((a, i) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <span className="text-muted-foreground w-4 shrink-0 text-sm tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link
                            href={`/admin/articles/${a.id}`}
                            className="hover:text-gold-strong truncate text-sm font-medium"
                          >
                            {a.title}
                          </Link>
                          <span className="text-muted-foreground text-xs">
                            {a.category.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums">
                          <EyeIcon className="size-3" aria-hidden />
                          {a.views.toLocaleString('id-ID')}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileEditIcon
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                  Draf terakhir saya
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recent_drafts.length === 0 ? (
                  <EmptyState
                    title="Tidak ada draf"
                    description="Anda belum memiliki artikel draf atau terjadwal."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.recent_drafts.map((d) => (
                      <li key={d.id} className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link
                            href={`/admin/articles/${d.id}`}
                            className="hover:text-gold-strong truncate text-sm font-medium"
                          >
                            {d.title}
                          </Link>
                          <span className="text-muted-foreground text-xs">
                            Diperbarui {relativeWib(d.updated_at)}
                          </span>
                        </div>
                        <StatusBadge status={d.status as ArticleStatus} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDaysIcon
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                  Agenda terdekat
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.upcoming_events.length === 0 ? (
                  <EmptyState
                    title="Tidak ada agenda"
                    description="Belum ada agenda mendatang yang terjadwal."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.upcoming_events.map((ev) => (
                      <li key={ev.id} className="flex flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {ev.title}
                        </span>
                        <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="flex items-center gap-1">
                            <CalendarDaysIcon className="size-3" aria-hidden />
                            {formatWib(ev.starts_at, 'd MMM yyyy, HH:mm')} WIB
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="size-3" aria-hidden />
                            {ev.location_name}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
