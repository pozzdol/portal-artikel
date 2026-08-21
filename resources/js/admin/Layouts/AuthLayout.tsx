import type { ReactNode } from 'react';

interface AuthLayoutProps {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer?: ReactNode;
}

/* Bento sengaja tidak dipakai di sini. Halaman masuk punya satu gagasan;
   grid modular justru memecah perhatian. Yang dibawa hanya bahasa
   permukaannya — dasar hangat, kartu putih, garis rambut, tipografi sans. */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
    return (
        <div className="ui-page flex min-h-screen flex-col items-center justify-center px-5 py-12">
            <div className="w-full max-w-100">
                <div className="mb-7 flex flex-col items-start">
                    <div className="ui-chip flex size-11 items-center justify-center">
                        <img src="/images/logo.png" alt="" className="size-6 object-contain" />
                    </div>

                    <h1 className="mt-4 text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">
                        {title}
                    </h1>
                    <p className="mt-1 text-sm leading-relaxed text-(--ui-ink-2)">{subtitle}</p>
                </div>

                <div className="ui-tile p-6 sm:p-7">{children}</div>

                {footer ? (
                    <div className="mt-5 text-sm text-(--ui-ink-2)">{footer}</div>
                ) : null}

                <p className="mt-10 text-xs text-(--ui-ink-2)">
                    ALMAIDAH &middot; Alumni Darul Hikmah Sumedang
                </p>
            </div>
        </div>
    );
}
