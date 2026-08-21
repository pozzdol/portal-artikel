import * as React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuNode {
    id: string;
    title: string;
    icon: string | null;
    url: string | null;
    routeName: string | null;
    children: MenuNode[];
}

interface SharedProps {
    auth: { user: { name: string; byline: string; email: string; roles: string[] } | null };
    menu: MenuNode[];
    [key: string]: unknown;
}

interface AdminLayoutProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export default function AdminLayout({ title, description, children }: AdminLayoutProps) {
    const page = usePage<SharedProps>();
    const { auth, menu } = page.props;

    return (
        <div className="ui-page min-h-screen">
            <div className="mx-auto flex w-full max-w-[100rem] gap-0 lg:gap-2">
                <Sidebar menu={menu} currentUrl={page.url} />

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex flex-wrap items-start justify-between gap-4 px-5 py-6 lg:px-6">
                        <div className="min-w-0">
                            <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em]">
                                {title}
                            </h1>
                            {description ? (
                                <p className="mt-1 text-sm text-[var(--ui-ink-2)]">{description}</p>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                            <ThemeToggle />

                            <div className="ui-chip hidden items-baseline gap-2 px-3.5 py-2 sm:flex">
                                <span className="text-sm font-medium">{auth.user?.byline}</span>
                                <span className="text-xs text-[var(--ui-ink-2)]">
                                    {auth.user?.roles.join(', ')}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.post('/admin/logout')}
                                className="ui-btn-quiet ui-focus flex size-10 items-center justify-center border-0"
                                aria-label="Keluar"
                            >
                                <LogOut className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    <main className="flex-1 px-5 pb-12 lg:px-6">{children}</main>
                </div>
            </div>
        </div>
    );
}

function Sidebar({ menu, currentUrl }: { menu: MenuNode[]; currentUrl: string }) {
    return (
        <aside className="hidden w-60 shrink-0 flex-col gap-5 px-4 py-6 lg:flex">
            <div className="flex items-center gap-2.5 px-2">
                <img src="/images/logo.png" alt="" className="size-7 object-contain" />
                <span className="text-[0.95rem] font-semibold tracking-[-0.01em]">ALMAIDAH</span>
            </div>

            <nav className="flex flex-col gap-0.5" aria-label="Menu panel">
                {menu.map((node) => (
                    <MenuGroup key={node.id} node={node} currentUrl={currentUrl} />
                ))}
            </nav>
        </aside>
    );
}

function MenuGroup({ node, currentUrl }: { node: MenuNode; currentUrl: string }) {
    if (node.children.length === 0) {
        return <MenuLink node={node} currentUrl={currentUrl} />;
    }

    return (
        <div className="mt-4 flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[0.68rem] font-medium tracking-[0.06em] text-[var(--ui-ink-2)] uppercase">
                {node.title}
            </span>
            {node.children.map((child) => (
                <MenuLink key={child.id} node={child} currentUrl={currentUrl} />
            ))}
        </div>
    );
}

function MenuLink({ node, currentUrl }: { node: MenuNode; currentUrl: string }) {
    const icon = node.icon ? (
        <i className={`ti ti-${node.icon} text-[1.05rem]`} aria-hidden="true" />
    ) : null;

    // url null berarti halamannya memang belum dibangun. Ditampilkan mati,
    // bukan disembunyikan — supaya menu mencerminkan rencana yang di-seed.
    if (!node.url) {
        return (
            <span
                className="flex cursor-not-allowed items-center gap-2.5 rounded-[var(--ui-r-control)] px-3 py-2 text-sm text-[var(--ui-ink-2)] opacity-70"
                title="Halaman ini belum dibangun"
            >
                {icon}
                <span className="min-w-0 truncate">{node.title}</span>
                <span className="ml-auto text-[0.6rem] tracking-wide uppercase">Segera</span>
            </span>
        );
    }

    const active = currentUrl === new URL(node.url, window.location.origin).pathname;

    return (
        <Link
            href={node.url}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'ui-focus flex items-center gap-2.5 rounded-[var(--ui-r-control)] px-3 py-2 text-sm transition-colors',
                active
                    ? 'bg-[var(--ui-surface)] font-medium text-[var(--ui-ink)] shadow-[var(--ui-shadow)]'
                    : 'text-[var(--ui-ink-2)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-ink)]',
            )}
        >
            {icon}
            <span className="min-w-0 truncate">{node.title}</span>
        </Link>
    );
}

function ThemeToggle() {
    const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'));

    function toggle() {
        const next = !dark;
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
        setDark(next);
    }

    return (
        <button
            type="button"
            onClick={toggle}
            className="ui-btn-quiet ui-focus flex size-10 items-center justify-center border-0"
            aria-label={dark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
        >
            {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
        </button>
    );
}
