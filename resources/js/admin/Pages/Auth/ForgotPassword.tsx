import { Head, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import AuthLayout from '@/admin/Layouts/AuthLayout';
import { SubmitButton, Field, TextLink } from '@/admin/Components/form';

export default function ForgotPassword() {
    const { flash } = usePage<{ flash: { status?: string } }>().props;
    const sent = flash?.status === 'sent';

    const form = useForm({ email: '' });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        form.post('/admin/forgot-password');
    }

    return (
        <AuthLayout
            title="Atur Ulang Sandi"
            subtitle="Kami kirim tautan pengaturan ulang ke email admin Anda."
            footer={
                <TextLink href="/admin/login" className="inline-flex items-center gap-1.5">
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Kembali ke halaman masuk
                </TextLink>
            }
        >
            <Head title="Atur Ulang Sandi" />

            {sent ? (
                <div className="ui-step flex flex-col items-center gap-4 text-center">
                    <div className="ui-tile flex size-14 items-center justify-center rounded-full">
                        <MailCheck className="size-6 text-[var(--ui-ok)]" aria-hidden="true" />
                    </div>

                    <div>
                        <p className="font-semibold">Tautan terkirim</p>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--ui-ink-2)]">
                            Kalau <span className="text-[var(--ui-ink)]">{form.data.email}</span>{' '}
                            terdaftar, tautan pengaturan ulang sudah masuk ke kotak masuknya.
                            Berlaku 60 menit.
                        </p>
                    </div>

                    <SubmitButton type="button" onClick={() => form.reset()} className="mt-1">
                        Kirim ke email lain
                    </SubmitButton>
                </div>
            ) : (
                <form onSubmit={submit} className="ui-step flex flex-col gap-5" noValidate>
                    <Field
                        label="Alamat email"
                        type="email"
                        name="email"
                        autoComplete="username"
                        placeholder="nama@almaidah.id"
                        autoFocus
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        error={form.errors.email}
                        disabled={form.processing}
                    />

                    <SubmitButton type="submit" loading={form.processing} loadingLabel="Mengirim">
                        Kirim tautan
                    </SubmitButton>
                </form>
            )}
        </AuthLayout>
    );
}
