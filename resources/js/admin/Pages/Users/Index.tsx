import * as React from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '@/admin/Layouts/AdminLayout';
import { Avatar, Badge, SelectControl } from '@/admin/Components/form';
import { cn } from '@/lib/utils';

interface UserRow {
    id: string;
    slug: string;
    name: string;
    pen_name: string | null;
    byline: string;
    initials: string;
    email: string;
    isActive: boolean;
    isInvited: boolean;
    mustChangePassword: boolean;
    roles: string[];
    activeRole: string | null;
}

interface Paginated<T> {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
    total: number;
    from: number | null;
    to: number | null;
}

interface Props {
    users: Paginated<UserRow>;
    filters: { cari?: string; peran?: string; status?: string };
    roles: string[];
}

export default function Index({ users, filters, roles }: Props) {
    const { auth } = usePage<{ auth: { user: { permissions: string[] } | null } }>().props;
    const can = (permission: string) => auth.user?.permissions.includes(permission) ?? false;

    const [cari, setCari] = React.useState(filters.cari ?? '');

    function applyFilters(next: Partial<Props['filters']>) {
        router.get('/admin/pengguna', { ...filters, ...next }, { preserveState: true, replace: true });
    }

    return (
        <AdminLayout
            title="Pengguna"
            description={`${users.total} akun terdaftar. Akun dinonaktifkan, tidak dihapus — byline artikel lamanya tetap utuh.`}
        >
            <Head title="Pengguna" />

            <div className="ui-tile p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters({ cari });
                        }}
                        className="flex flex-wrap items-center gap-2"
                    >
                        <input
                            type="search"
                            value={cari}
                            onChange={(e) => setCari(e.target.value)}
                            placeholder="Cari nama atau email"
                            aria-label="Cari pengguna"
                            className="ui-field ui-focus h-10 w-56 px-3.5 text-sm"
                        />

                        <SelectControl
                            aria-label="Saring peran"
                            value={filters.peran ?? ''}
                            onValueChange={(peran) => applyFilters({ peran })}
                            emptyLabel="Semua peran"
                            placeholder="Semua peran"
                            options={roles.map((role) => ({ value: role, label: role }))}
                            className="h-10 w-44 text-sm"
                        />

                        <SelectControl
                            aria-label="Saring status"
                            value={filters.status ?? ''}
                            onValueChange={(status) => applyFilters({ status })}
                            emptyLabel="Semua status"
                            placeholder="Semua status"
                            options={[
                                { value: 'aktif', label: 'Aktif' },
                                { value: 'nonaktif', label: 'Nonaktif' },
                                { value: 'undangan', label: 'Undangan belum diterima' },
                            ]}
                            className="h-10 w-52 text-sm"
                        />
                    </form>

                    {can('invite user') ? (
                        <Link
                            href="/admin/pengguna/undang"
                            className="ui-btn ui-focus inline-flex h-10 items-center gap-2 px-4 text-sm font-medium"
                        >
                            <UserPlus className="size-4" aria-hidden="true" />
                            Undang pengguna
                        </Link>
                    ) : null}
                </div>

                {users.data.length === 0 ? (
                    <p className="mt-8 text-sm text-[var(--ui-ink-2)]">
                        Tidak ada pengguna yang cocok dengan saringan ini.
                    </p>
                ) : (
                    <ul className="mt-5 flex flex-col">
                        {users.data.map((user) => (
                            <li
                                key={user.id}
                                className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--ui-r-control)] px-2 py-3 transition-colors hover:bg-[var(--ui-surface-2)]"
                            >
                                <Avatar initials={user.initials} id={user.id} />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {user.name}
                                        {user.pen_name && user.pen_name !== user.name ? (
                                            <span className="ml-2 font-normal text-[var(--ui-ink-2)]">
                                                menulis sebagai {user.pen_name}
                                            </span>
                                        ) : null}
                                    </p>
                                    <p className="truncate text-xs text-[var(--ui-ink-2)]">{user.email}</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    {user.roles.map((role) => (
                                        <Badge key={role} tone={role === user.activeRole ? 'warn' : 'quiet'}>
                                            {role}
                                            {role === user.activeRole && user.roles.length > 1 ? ' · aktif' : ''}
                                        </Badge>
                                    ))}
                                </div>

                                <StatusBadge user={user} />

                                <div className="flex items-center gap-1.5">
                                    {can('update user') ? (
                                        <Link
                                            href={`/admin/pengguna/${user.slug}/sunting`}
                                            className="ui-btn-quiet ui-focus inline-flex h-8 items-center px-3 text-xs font-medium"
                                        >
                                            Sunting
                                        </Link>
                                    ) : null}

                                    {can('invite user') && user.isInvited ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(`/admin/pengguna/${user.slug}/undang-ulang`)
                                            }
                                            className="ui-btn-quiet ui-focus inline-flex h-8 items-center px-3 text-xs font-medium"
                                        >
                                            Kirim ulang
                                        </button>
                                    ) : null}

                                    {can('deactivate user') ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.patch(`/admin/pengguna/${user.slug}/status`)
                                            }
                                            className={cn(
                                                'ui-btn-quiet ui-focus inline-flex h-8 items-center px-3 text-xs font-medium',
                                                user.isActive && 'text-[var(--ui-danger)]',
                                            )}
                                        >
                                            {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                        </button>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination links={users.links} from={users.from} to={users.to} total={users.total} />
            </div>
        </AdminLayout>
    );
}

function StatusBadge({ user }: { user: UserRow }) {
    if (!user.isActive) {
        return <Badge tone="danger">Nonaktif</Badge>;
    }

    if (user.isInvited) {
        return <Badge tone="warn">Undangan terkirim</Badge>;
    }

    // Alumni hasil impor: aktif, tapi masih memakai sandi bawaan.
    if (user.mustChangePassword) {
        return <Badge tone="warn">Belum ganti sandi</Badge>;
    }

    return <Badge tone="ok">Aktif</Badge>;
}

function Pagination({
    links,
    from,
    to,
    total,
}: {
    links: Paginated<UserRow>['links'];
    from: number | null;
    to: number | null;
    total: number;
}) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--ui-ink-2)]">
                Menampilkan {from}–{to} dari {total}
            </p>

            <div className="flex flex-wrap gap-1">
                {links.map((link, index) =>
                    link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            aria-current={link.active ? 'page' : undefined}
                            className={cn(
                                'ui-focus inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--ui-r-control)] px-2 text-xs',
                                link.active
                                    ? 'bg-[var(--ui-ink)] text-[var(--ui-paper)]'
                                    : 'hover:bg-[var(--ui-surface-2)]',
                            )}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ) : (
                        <span
                            key={index}
                            className="inline-flex h-8 min-w-8 items-center justify-center px-2 text-xs text-[var(--ui-ink-2)] opacity-50"
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ),
                )}
            </div>
        </div>
    );
}
