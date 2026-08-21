import * as React from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/admin/Layouts/AdminLayout';
import { cn } from '@/lib/utils';

interface Counts {
    draft: number;
    returned: number;
    in_review: number;
    scheduled: number;
    published: number;
    archived: number;
}

interface RecentArticle {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    category: string | null;
    author: string | null;
    updatedAt: string | null;
}

interface TopCategory {
    id: string;
    name: string;
    isNav: boolean;
    published: number;
}

interface Library {
    mediaCount: number;
    mediaBytes: number;
}

interface DashboardProps {
    counts: Counts;
    recent: RecentArticle[];
    topCategories: TopCategory[];
    library: Library;
}

export default function Dashboard({ counts, recent, topCategories, library }: DashboardProps) {
    return (
        <AdminLayout title="Dashboard" description="Ringkasan naskah redaksi ALMAIDAH.">
            <Head title="Dashboard" />

            <div className="ui-bento">
                {/* Terbit — angka utama, tile terbesar */}
                <Tile span="col-span-2 sm:col-span-2 sm:row-span-2 xl:col-span-2 xl:row-span-2">
                    <div className="flex h-full flex-col">
                        <Eyebrow>Terbit</Eyebrow>
                        <div className="flex flex-1 flex-col justify-center py-4">
                            <p className="text-[3.75rem] leading-[0.9] font-semibold tracking-[-0.035em] tabular-nums">
                                {counts.published}
                            </p>
                            <p className="mt-3 max-w-[18ch] text-sm leading-relaxed text-[var(--ui-ink-2)]">
                                {counts.scheduled > 0
                                    ? `${counts.scheduled} lagi menunggu jadwal tayang.`
                                    : 'Belum ada yang dijadwalkan.'}
                            </p>
                        </div>
                    </div>
                </Tile>

                {/* Antrean review — satu-satunya tile yang menuntut tindakan */}
                <Tile span="col-span-2 sm:col-span-2 xl:col-span-2" accent={counts.in_review > 0}>
                    <Eyebrow>Menunggu review</Eyebrow>
                    <div className="mt-3 flex items-end gap-3">
                        <p className="text-[2.25rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                            {counts.in_review}
                        </p>
                        <p className="pb-1 text-sm text-[var(--ui-ink-2)]">
                            {counts.in_review > 0 ? 'naskah perlu dibaca redaktur' : 'antrean bersih'}
                        </p>
                    </div>
                </Tile>

                <Stat span="col-span-1" label="Draf" value={counts.draft} />
                <Stat span="col-span-1" label="Dikembalikan" value={counts.returned} />
                <Stat span="col-span-1" label="Terjadwal" value={counts.scheduled} />
                <Stat span="col-span-1" label="Arsip" value={counts.archived} />

                {/* Pustaka — mengunci sisa baris kedua supaya grid tidak berlubang */}
                <Tile span="col-span-2 sm:col-span-2 xl:col-span-2">
                    <Eyebrow>Pustaka media</Eyebrow>
                    <div className="mt-3 flex items-baseline gap-8">
                        <Figure label="Berkas" value={library.mediaCount.toString()} />
                        <Figure label="Terpakai" value={formatBytes(library.mediaBytes)} />
                    </div>
                </Tile>
                 {/* Naskah terbaru */}
                <Tile span="col-span-2 sm:col-span-4 xl:col-span-4">
                    <Eyebrow>Naskah terbaru</Eyebrow>

                    {recent.length === 0 ? (
                        <Empty>Belum ada naskah. Tulis yang pertama lewat menu Artikel.</Empty>
                    ) : (
                        <ul className="mt-2 flex flex-col">
                            {recent.map((article) => (
                                <li
                                    key={article.id}
                                    className="-mx-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[var(--ui-r-control)] px-2 py-2.5 transition-colors hover:bg-[var(--ui-surface-2)]"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                        {article.title}
                                    </span>
                                    <span className="text-xs text-[var(--ui-ink-2)]">
                                        {[article.category, article.author, article.updatedAt]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                    <StatusChip label={article.statusLabel} status={article.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Tile>

                {/* Rubrik */}
                <Tile span="col-span-2 sm:col-span-2 xl:col-span-2">
                    <Eyebrow>Rubrik</Eyebrow>

                    {topCategories.length === 0 ? (
                        <Empty>Belum ada rubrik aktif.</Empty>
                    ) : (
                        <ul className="mt-3 flex flex-col gap-2">
                            {topCategories.map((category) => (
                                <li key={category.id} className="flex items-center gap-3 text-sm">
                                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                                    {category.isNav ? (
                                        <span
                                            className="ui-chip shrink-0 px-1.5 py-0.5 text-[0.6rem] tracking-wide text-[var(--ui-ink-2)] uppercase"
                                            title="Tampil di navbar publik"
                                        >
                                            navbar
                                        </span>
                                    ) : null}
                                    <span
                                        className="w-6 shrink-0 text-right tabular-nums text-[var(--ui-ink-2)]"
                                        title="Artikel terbit di rubrik ini"
                                    >
                                        {category.published}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Tile>

           </div>
        </AdminLayout>
    );
}

function Tile({
    span,
    accent = false,
    children,
}: {
    span: string;
    accent?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section
            className={cn(
                'ui-tile p-5',
                span,
                // Aksen emas dipakai sekali saja, pada tile yang menuntut
                // tindakan. Tanpa garis: dibedakan lewat rendaman warna.
                accent && 'ui-tile-accent',
            )}
        >
            {children}
        </section>
    );
}

function Stat({ span, label, value }: { span: string; label: string; value: number }) {
    return (
        <Tile span={span}>
            <Eyebrow>{label}</Eyebrow>
            <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {value}
            </p>
        </Tile>
    );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[0.7rem] font-medium tracking-[0.06em] text-[var(--ui-ink-2)] uppercase">
            {children}
        </p>
    );
}

function Figure({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xl leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
            <p className="mt-1.5 text-xs text-[var(--ui-ink-2)]">{label}</p>
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="mt-3 text-sm leading-relaxed text-[var(--ui-ink-2)]">{children}</p>;
}

function StatusChip({ label, status }: { label: string; status: string }) {
    return (
        <span
            className={cn(
                'ui-chip shrink-0 px-2 py-0.5 text-[0.68rem] font-medium',
                status === 'published' && 'text-[var(--ui-ok)]',
                status === 'returned' && 'text-[var(--ui-danger)]',
                status === 'in_review' && 'text-[var(--ui-accent-ink)]',
            )}
        >
            {label}
        </span>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) {
        return '0 KB';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;

    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
