import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AuthLayout from '@/admin/Layouts/AuthLayout';
import { SubmitButton, Field, TextLink } from '@/admin/Components/form';

interface ResetPasswordProps {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const form = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.post('/admin/reset-password', {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    }

    return (
        <AuthLayout
            title="Sandi Baru"
            subtitle="Pilih kata sandi baru untuk akun admin Anda."
            footer={
                <TextLink href="/admin/login" className="inline-flex items-center gap-1.5">
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Kembali ke halaman masuk
                </TextLink>
            }
        >
            <Head title="Sandi Baru" />

            <form onSubmit={submit} className="ui-step flex flex-col gap-5" noValidate>
                <Field
                    label="Alamat email"
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                    error={form.errors.email}
                    disabled={form.processing}
                    readOnly={Boolean(email)}
                />

                <Field
                    label="Kata sandi baru"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    autoFocus
                    value={form.data.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                    error={form.errors.password}
                    hint="Minimal 8 karakter."
                    disabled={form.processing}
                />

                <Field
                    label="Ulangi kata sandi"
                    type="password"
                    name="password_confirmation"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.data.password_confirmation}
                    onChange={(e) => form.setData('password_confirmation', e.target.value)}
                    error={form.errors.password_confirmation}
                    disabled={form.processing}
                />

                <SubmitButton type="submit" loading={form.processing} loadingLabel="Menyimpan">
                    Simpan sandi baru
                </SubmitButton>
            </form>
        </AuthLayout>
    );
}
