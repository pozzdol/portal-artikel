import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AdminLayout from '@/admin/Layouts/AdminLayout';
import { CheckRow, Field, SelectField, SubmitButton } from '@/admin/Components/form';
import RoleAssignment from '@/admin/Components/RoleAssignment';

interface RoleOption {
    id: string;
    name: string;
    description: string | null;
}

export default function Invite({ roles }: { roles: RoleOption[] }) {
    const form = useForm<{ name: string; email: string; role_ids: string[]; default_role_id: string }>({
        name: '',
        email: '',
        role_ids: [],
        default_role_id: '',
    });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.post('/admin/pengguna');
    }

    return (
        <AdminLayout
            title="Undang pengguna"
            description="Penerima menetapkan kata sandinya sendiri lewat tautan. Akun aktif setelah itu."
        >
            <Head title="Undang pengguna" />

            <form onSubmit={submit} className="ui-tile max-w-2xl p-5 sm:p-6" noValidate>
                <div className="flex flex-col gap-5">
                    <Field
                        label="Nama lengkap"
                        name="name"
                        autoFocus
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        error={form.errors.name}
                        disabled={form.processing}
                    />

                    <Field
                        label="Alamat email"
                        type="email"
                        name="email"
                        placeholder="nama@almaidah.id"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        error={form.errors.email}
                        hint="Undangan dikirim ke alamat ini."
                        disabled={form.processing}
                    />

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
                            loadingLabel="Mengirim"
                            className="w-auto px-5"
                        >
                            Kirim undangan
                        </SubmitButton>

                        <Link
                            href="/admin/pengguna"
                            className="ui-focus inline-flex items-center gap-1.5 rounded-sm text-sm text-[var(--ui-ink-2)] hover:text-[var(--ui-ink)]"
                        >
                            <ArrowLeft className="size-3.5" aria-hidden="true" />
                            Batal
                        </Link>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}
