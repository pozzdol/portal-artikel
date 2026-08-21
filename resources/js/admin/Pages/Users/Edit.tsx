import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AdminLayout from '@/admin/Layouts/AdminLayout';
import { Avatar, Badge, Field, SubmitButton } from '@/admin/Components/form';
import RoleAssignment from '@/admin/Components/RoleAssignment';
import ProfileFields, { type ProfileValues } from '@/admin/Components/ProfileFields';

interface RoleOption {
    id: string;
    name: string;
    description: string | null;
}

interface EditableUser extends ProfileValues {
    id: string;
    slug: string;
    initials: string;
    isActive: boolean;
    isInvited: boolean;
    role_ids: string[];
    activeRole: string | null;
}

export default function Edit({ user, roles }: { user: EditableUser; roles: RoleOption[] }) {
    const form = useForm({
        name: user.name ?? '',
        email: user.email ?? '',
        pen_name: user.pen_name ?? '',
        bio: user.bio ?? '',
        public_email: user.public_email ?? '',
        instagram: user.instagram ?? '',
        x_handle: user.x_handle ?? '',
        angkatan: user.angkatan ?? '',
        phone: user.phone ?? '',
        birth_place: user.birth_place ?? '',
        birth_date: user.birth_date ?? '',
        tahun_masuk: user.tahun_masuk ?? '',
        kesibukan: user.kesibukan ?? '',
        nama_instansi: user.nama_instansi ?? '',
        kota_domisili: user.kota_domisili ?? '',
        provinsi_domisili: user.provinsi_domisili ?? '',
        asatidz_title: user.asatidz_title ?? '',
        role_ids: user.role_ids,
        default_role_id: roles.find((r) => r.name === user.activeRole)?.id ?? '',
    });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.put(`/admin/pengguna/${user.slug}`);
    }

    return (
        <AdminLayout title="Sunting pengguna" description="Peran dan data profil. Status aktif diubah dari daftar pengguna.">
            <Head title={`Sunting ${user.name}`} />

            <form onSubmit={submit} className="ui-tile max-w-2xl p-5 sm:p-6" noValidate>
                <div className="flex items-center gap-3 pb-5">
                    <Avatar initials={user.initials} id={user.id} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-[var(--ui-ink-2)]">/penulis/{user.slug}</p>
                    </div>
                    {user.isInvited ? (
                        <Badge tone="warn">Undangan belum diterima</Badge>
                    ) : user.isActive ? (
                        <Badge tone="ok">Aktif</Badge>
                    ) : (
                        <Badge tone="danger">Nonaktif</Badge>
                    )}
                </div>

                <div className="flex flex-col gap-5">
                    <ProfileFields form={form} />

                    <RoleAssignment
                        roles={roles}
                        selected={form.data.role_ids}
                        activeRoleId={form.data.default_role_id}
                        onSelectedChange={(ids) => form.setData('role_ids', ids)}
                        onActiveChange={(id) => form.setData('default_role_id', id)}
                        rolesError={form.errors.role_ids}
                        activeError={form.errors.default_role_id}
                        disabled={form.processing}
                    />

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <SubmitButton
                            type="submit"
                            loading={form.processing}
                            loadingLabel="Menyimpan"
                            className="w-auto px-5"
                        >
                            Simpan perubahan
                        </SubmitButton>

                        <Link
                            href="/admin/pengguna"
                            className="ui-focus inline-flex items-center gap-1.5 rounded-sm text-sm text-[var(--ui-ink-2)] hover:text-[var(--ui-ink)]"
                        >
                            <ArrowLeft className="size-3.5" aria-hidden="true" />
                            Kembali
                        </Link>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}
