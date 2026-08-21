import { Field } from '@/admin/Components/form';

export interface ProfileValues {
    name: string;
    email: string;
    pen_name: string | null;
    bio: string | null;
    public_email: string | null;
    instagram: string | null;
    x_handle: string | null;
    phone: string | null;
    birth_place: string | null;
    birth_date: string | null;
    angkatan: number | string | null;
    tahun_masuk: number | string | null;
    kesibukan: string | null;
    nama_instansi: string | null;
    kota_domisili: string | null;
    provinsi_domisili: string | null;
    asatidz_title: string | null;
}

type FormLike = {
    data: Record<string, unknown>;
    errors: Partial<Record<string, string>>;
    processing: boolean;
    setData: (key: never, value: never) => void;
};

/* Dipakai dua tempat: admin menyunting orang lain, dan orang menyunting
   dirinya sendiri. Isinya identik, jadi tidak ditulis dua kali. */
export default function ProfileFields({ form }: { form: FormLike }) {
    const bind = (key: keyof ProfileValues) => ({
        value: (form.data[key] as string | number | null) ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            form.setData(key as never, e.target.value as never),
        error: form.errors[key],
        disabled: form.processing,
    });

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nama lengkap" name="name" {...bind('name')} />
                <Field
                    label="Alamat email"
                    type="email"
                    name="email"
                    placeholder="Boleh kosong"
                    {...bind('email')}
                />
                <Field
                    label="Nomor HP"
                    name="phone"
                    placeholder="8211..."
                    hint="Email atau nomor HP — minimal salah satu."
                    {...bind('phone')}
                />
            </div>

            <Section title="Byline" hint="Yang tampil sebagai penulis di halaman artikel.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Nama pena"
                        name="pen_name"
                        placeholder="Kosongkan untuk memakai nama lengkap"
                        {...bind('pen_name')}
                    />
                    <Field label="Gelar asatidz" name="asatidz_title" placeholder="Opsional" {...bind('asatidz_title')} />
                </div>

                <Field label="Bio singkat" name="bio" placeholder="Satu sampai dua kalimat" {...bind('bio')} />
            </Section>

            <Section title="Kontak publik" hint="Tampil di kartu penulis. Boleh dikosongkan.">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Email publik" type="email" name="public_email" {...bind('public_email')} />
                    <Field label="Instagram" name="instagram" placeholder="@nama" {...bind('instagram')} />
                    <Field label="X" name="x_handle" placeholder="@nama" {...bind('x_handle')} />
                </div>
            </Section>

            <Section title="Kelahiran" hint="Tempat dan tanggal lahir.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tempat lahir" name="birth_place" placeholder="Sumedang" {...bind('birth_place')} />
                    <Field label="Tanggal lahir" type="date" name="birth_date" {...bind('birth_date')} />
                </div>
            </Section>

            <Section title="Riwayat pesantren" hint="Angkatan adalah tahun keluar (lulus).">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tahun masuk" type="number" name="tahun_masuk" placeholder="2016" {...bind('tahun_masuk')} />
                    <Field label="Angkatan (tahun keluar)" type="number" name="angkatan" placeholder="2022" {...bind('angkatan')} />
                </div>
            </Section>

            <Section title="Kesibukan & domisili" hint="Untuk rubrik Alumni dan halaman penulis.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Kesibukan" name="kesibukan" placeholder="kuliah / bekerja" {...bind('kesibukan')} />
                    <Field label="Nama instansi" name="nama_instansi" placeholder="Kampus atau tempat kerja" {...bind('nama_instansi')} />
                    <Field label="Kota domisili" name="kota_domisili" placeholder="KABUPATEN SUMEDANG" {...bind('kota_domisili')} />
                    <Field label="Provinsi domisili" name="provinsi_domisili" placeholder="JAWA BARAT" {...bind('provinsi_domisili')} />
                </div>
            </Section>
        </>
    );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3">
            <div>
                <p className="text-[0.7rem] font-medium tracking-[0.06em] text-[var(--ui-ink-2)] uppercase">
                    {title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ui-ink-2)]">{hint}</p>
            </div>
            {children}
        </div>
    );
}
