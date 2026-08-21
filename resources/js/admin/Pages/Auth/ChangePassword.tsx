import { Head, useForm } from '@inertiajs/react';
import AuthLayout from '@/admin/Layouts/AuthLayout';
import { Field, SubmitButton } from '@/admin/Components/form';

export default function ChangePassword({ forced }: { forced: boolean }) {
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.put('/admin/ganti-sandi', {
            onFinish: () => form.reset('current_password', 'password', 'password_confirmation'),
        });
    }

    return (
        <AuthLayout
            title={forced ? 'Buat Kata Sandi Baru' : 'Ganti Kata Sandi'}
            subtitle={
                forced
                    ? 'Sandi awal Anda diturunkan dari tanggal lahir, jadi hanya berlaku sekali. Buat sandi baru untuk melanjutkan.'
                    : 'Pilih kata sandi baru untuk akun Anda.'
            }
        >
            <Head title={forced ? 'Buat Kata Sandi Baru' : 'Ganti Kata Sandi'} />

            <form onSubmit={submit} className="ui-step flex flex-col gap-5" noValidate>
                <Field
                    label={forced ? 'Kata sandi saat ini (tanggal lahir)' : 'Kata sandi saat ini'}
                    type="password"
                    name="current_password"
                    autoComplete="current-password"
                    autoFocus
                    value={form.data.current_password}
                    onChange={(e) => form.setData('current_password', e.target.value)}
                    error={form.errors.current_password}
                    hint={forced ? 'Format yyyymmdd, misalnya 20040224.' : undefined}
                    disabled={form.processing}
                />

                <Field
                    label="Kata sandi baru"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={form.data.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                    error={form.errors.password}
                    hint="Minimal 8 karakter."
                    disabled={form.processing}
                />

                <Field
                    label="Ulangi kata sandi baru"
                    type="password"
                    name="password_confirmation"
                    autoComplete="new-password"
                    value={form.data.password_confirmation}
                    onChange={(e) => form.setData('password_confirmation', e.target.value)}
                    error={form.errors.password_confirmation}
                    disabled={form.processing}
                />

                <SubmitButton type="submit" loading={form.processing} loadingLabel="Menyimpan">
                    Simpan kata sandi
                </SubmitButton>
            </form>
        </AuthLayout>
    );
}
