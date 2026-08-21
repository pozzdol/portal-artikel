import { Head, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/admin/Layouts/AdminLayout';
import { Avatar, Badge, SubmitButton } from '@/admin/Components/form';
import ProfileFields, { type ProfileValues } from '@/admin/Components/ProfileFields';

interface Profile extends ProfileValues {
    slug: string;
    initials: string;
    roles: string[];
    activeRole: string | null;
}

export default function Edit({ profile }: { profile: Profile }) {
    const { flash } = usePage<{ flash: { status?: string } }>().props;

    const form = useForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        pen_name: profile.pen_name ?? '',
        bio: profile.bio ?? '',
        public_email: profile.public_email ?? '',
        instagram: profile.instagram ?? '',
        x_handle: profile.x_handle ?? '',
        angkatan: profile.angkatan ?? '',
        phone: profile.phone ?? '',
        birth_place: profile.birth_place ?? '',
        birth_date: profile.birth_date ?? '',
        tahun_masuk: profile.tahun_masuk ?? '',
        kesibukan: profile.kesibukan ?? '',
        nama_instansi: profile.nama_instansi ?? '',
        kota_domisili: profile.kota_domisili ?? '',
        provinsi_domisili: profile.provinsi_domisili ?? '',
        asatidz_title: profile.asatidz_title ?? '',
    });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.put('/admin/profil', { preserveScroll: true });
    }

    return (
        <AdminLayout
            title="Profil Saya"
            description="Peran dan status akun hanya bisa diubah admin."
        >
            <Head title="Profil Saya" />

            <form onSubmit={submit} className="ui-tile max-w-2xl p-5 sm:p-6" noValidate>
                <div className="flex flex-wrap items-center gap-3 pb-5">
                    <Avatar initials={profile.initials} id={profile.slug} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{profile.name}</p>
                        <p className="truncate text-xs text-[var(--ui-ink-2)]">/penulis/{profile.slug}</p>
                    </div>
                    {profile.roles.map((role) => (
                        <Badge key={role} tone={role === profile.activeRole ? 'warn' : 'quiet'}>
                            {role}
                            {role === profile.activeRole && profile.roles.length > 1 ? ' · aktif' : ''}
                        </Badge>
                    ))}
                </div>

                <div className="flex flex-col gap-5">
                    <ProfileFields form={form} />

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <SubmitButton
                            type="submit"
                            loading={form.processing}
                            loadingLabel="Menyimpan"
                            className="w-auto px-5"
                        >
                            Simpan profil
                        </SubmitButton>

                        {flash?.status && !form.isDirty ? (
                            <span className="text-sm text-[var(--ui-ok)]">{flash.status}</span>
                        ) : null}
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}
