'use client';

import type { ReactNode } from 'react';

import { useMe } from '@/lib/api/admin/auth';

import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';
import { SessionsTable } from './SessionsTable';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-line grid gap-6 border-t pt-6 lg:grid-cols-[260px_1fr] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-meta mt-1 text-[13px] leading-relaxed">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function ProfileView() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="font-serif text-[32px] leading-tight font-semibold">
          Profil saya
        </h1>
        <p className="text-meta mt-1">
          {me.email}
          {me.roles.length
            ? ` (${me.roles.map((r) => r.name).join(', ')})`
            : ''}
        </p>
      </header>
      <Section
        title="Data diri"
        description="Nama, gelar, bio, dan foto yang tampil di artikel dan halaman penulis."
      >
        <ProfileForm me={me} />
      </Section>
      <Section
        title="Kata sandi"
        description="Setelah diganti, semua sesi di perangkat lain otomatis dikeluarkan."
      >
        <PasswordForm />
      </Section>
      <Section
        title="Sesi aktif"
        description="Perangkat yang sedang masuk dengan akun Anda. Keluarkan yang tidak Anda kenali."
      >
        <SessionsTable />
      </Section>
    </div>
  );
}
