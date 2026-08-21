import * as React from 'react';
import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft, Check } from 'lucide-react';
import AuthLayout from '@/admin/Layouts/AuthLayout';
import { SubmitButton, Field, TextLink } from '@/admin/Components/form';
import { cn } from '@/lib/utils';

type Step = 'email' | 'password';

async function lookupEmail(email: string): Promise<boolean> {
    const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

    const response = await fetch('/admin/login/check-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify({ email }),
    });

    if (response.status === 429) {
        throw new Error('Terlalu banyak percobaan. Coba lagi sebentar lagi.');
    }

    if (!response.ok) {
        throw new Error('Gagal memeriksa email. Coba lagi.');
    }

    const data: { registered: boolean } = await response.json();

    return data.registered;
}

export default function Login() {
    const [step, setStep] = React.useState<Step>('email');
    const [checking, setChecking] = React.useState(false);
    const [emailError, setEmailError] = React.useState<string | null>(null);
    const passwordRef = React.useRef<HTMLInputElement>(null);

    const form = useForm({ email: '', password: '', remember: false });

    async function submitEmail(event: React.FormEvent) {
        event.preventDefault();
        setEmailError(null);

        if (!/^\S+@\S+\.\S+$/.test(form.data.email)) {
            setEmailError('Masukkan alamat email yang valid.');
            return;
        }

        setChecking(true);
        try {
            const registered = await lookupEmail(form.data.email);

            if (!registered) {
                setEmailError('Email ini tidak terdaftar sebagai admin aktif.');
                return;
            }

            setStep('password');
            window.setTimeout(() => passwordRef.current?.focus(), 60);
        } catch (error) {
            setEmailError(error instanceof Error ? error.message : 'Terjadi kesalahan.');
        } finally {
            setChecking(false);
        }
    }

    function submitPassword(event: React.FormEvent) {
        event.preventDefault();
        form.post('/admin/login', {
            onError: () => form.setData('password', ''),
        });
    }

    function backToEmail() {
        setStep('email');
        form.setData('password', '');
        form.clearErrors();
        setEmailError(null);
    }

    return (
        <AuthLayout
            title="Masuk ke Panel"
            subtitle="Kelola kajian, berita, dan kabar alumni ALMAIDAH."
            footer={
                <>
                    Belum punya akses?{' '}
                    <TextLink href="mailto:redaksi@almaidah.id">Hubungi redaksi</TextLink>
                </>
            }
        >
            <Head title="Masuk" />

            <StepTrack step={step} />

            {step === 'email' ? (
                <form onSubmit={submitEmail} className="ui-step mt-6 flex flex-col gap-5" noValidate>
                    <Field
                        label="Alamat email"
                        type="email"
                        name="email"
                        autoComplete="username"
                        placeholder="nama@almaidah.id"
                        autoFocus
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        error={emailError ?? undefined}
                        hint="Kami cek dulu apakah email ini terdaftar."
                        disabled={checking}
                    />

                    <SubmitButton type="submit" loading={checking} loadingLabel="Memeriksa">
                        Lanjutkan
                    </SubmitButton>
                </form>
            ) : (
                <form onSubmit={submitPassword} className="ui-step mt-6 flex flex-col gap-5" noValidate>
                    <IdentityChip email={form.data.email} onEdit={backToEmail} />

                    <Field
                        ref={passwordRef}
                        label="Kata sandi"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={form.data.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                        error={form.errors.password}
                        disabled={form.processing}
                    />

                    <SubmitButton type="submit" loading={form.processing} loadingLabel="Masuk">
                        Masuk
                    </SubmitButton>

                    <div className="text-center text-sm">
                        <TextLink href="/admin/forgot-password">Lupa kata sandi?</TextLink>
                    </div>
                </form>
            )}
        </AuthLayout>
    );
}

function StepTrack({ step }: { step: Step }) {
    const steps: Array<{ id: Step; label: string }> = [
        { id: 'email', label: 'Email' },
        { id: 'password', label: 'Kata sandi' },
    ];
    const activeIndex = steps.findIndex((s) => s.id === step);

    return (
        <ol className="flex items-center gap-3" aria-label="Tahap masuk">
            {steps.map((s, index) => {
                const done = index < activeIndex;
                const active = index === activeIndex;

                return (
                    <li key={s.id} className="flex flex-1 flex-col gap-2">
                        <span
                            className={cn(
                                'h-1.5 rounded-full',
                                active || done ? 'bg-[var(--ui-accent)]' : 'bg-[var(--ui-surface-2)]',
                            )}
                            aria-hidden="true"
                        />
                        <span
                            className={cn(
                                'flex items-center gap-1 text-[0.7rem] font-semibold tracking-[0.06em] uppercase',
                                active || done ? 'text-[var(--ui-ink)]' : 'text-[var(--ui-ink-2)]',
                            )}
                        >
                            {done ? <Check className="size-3" aria-hidden="true" /> : null}
                            {s.label}
                        </span>
                        <span className="sr-only">
                            {done ? 'selesai' : active ? 'tahap saat ini' : 'belum'}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function IdentityChip({ email, onEdit }: { email: string; onEdit: () => void }) {
    return (
        <div className="ui-chip flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate text-sm text-[var(--ui-ink)]">{email}</span>

            <button
                type="button"
                onClick={onEdit}
                className="ui-focus flex shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-[var(--ui-accent-ink)] hover:underline dark:text-[var(--ui-accent)]"
            >
                <ArrowLeft className="size-3" aria-hidden="true" />
                Ubah
            </button>
        </div>
    );
}
