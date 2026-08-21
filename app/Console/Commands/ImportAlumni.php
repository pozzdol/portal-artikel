<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ImportAlumni extends Command
{
    protected $signature = 'almaidah:import-alumni
        {file : Berkas CSV master alumni}
        {--dry-run : Tampilkan hasil tanpa menulis ke basis data}';

    protected $description = 'Impor data alumni dari CSV master ke tabel users sebagai peran Anggota';

    /** Sandi cadangan untuk baris yang tanggal lahirnya jelas keliru. */
    private const FALLBACK_PASSWORD = 'password';

    public function handle(): int
    {
        $path = $this->argument('file');

        if (! is_readable($path)) {
            $this->error("Tidak bisa membaca: {$path}");

            return self::FAILURE;
        }

        $role = Role::where('name', 'Anggota')->first();

        if (! $role) {
            $this->error('Peran "Anggota" belum ada. Jalankan RoleSeeder dulu.');

            return self::FAILURE;
        }

        $rows = $this->readCsv($path);
        $this->line(sprintf('Terbaca %d baris.', count($rows)));

        [$people, $mergedCount] = $this->mergeIdenticalRows($rows);
        $this->line(sprintf('%d orang setelah menggabungkan %d baris kembar.', count($people), $mergedCount));

        [$importable, $skipped] = $this->skipDuplicatePhones($people);
        $this->line(sprintf('%d siap diimpor, %d dilewati (nomor HP kembar).', count($importable), count($skipped)));

        foreach ($skipped as $row) {
            $this->warn(sprintf('  dilewati: %-14s %s', $row['no_hp'], $row['nama']));
        }

        if ($this->option('dry-run')) {
            $this->previewSample($importable);
            $this->info('Dry run — tidak ada yang ditulis.');

            return self::SUCCESS;
        }

        $created = 0;
        $updated = 0;
        $weakDate = 0;

        DB::transaction(function () use ($importable, $role, &$created, &$updated, &$weakDate) {
            foreach ($importable as $row) {
                [$attributes, $usedFallback] = $this->mapRow($row);
                $weakDate += $usedFallback ? 1 : 0;

                $existing = $this->findExisting($attributes);

                if ($existing) {
                    $existing->fill($attributes)->save();
                    $user = $existing;
                    $updated++;
                } else {
                    $user = User::create($attributes);
                    $created++;
                }

                $user->syncRoles([$role]);
                $user->forceFill(['default_role_id' => $role->id])->save();
            }
        });

        $this->info(sprintf('Selesai. %d dibuat, %d diperbarui.', $created, $updated));

        if ($weakDate > 0) {
            $this->warn(sprintf(
                '%d akun memakai sandi "%s" karena tanggal lahirnya tidak masuk akal.',
                $weakDate,
                self::FALLBACK_PASSWORD,
            ));
        }

        return self::SUCCESS;
    }

    /** @return list<array<string, string>> */
    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        $header = array_map(trim(...), fgetcsv($handle) ?: []);
        $rows = [];

        while (($line = fgetcsv($handle)) !== false) {
            if (count($line) !== count($header)) {
                continue;
            }

            $rows[] = array_map(
                fn ($v) => trim((string) $v),
                array_combine($header, $line),
            );
        }

        fclose($handle);

        return $rows;
    }

    /**
     * Baris dianggap kembar bila nama (tanpa peduli huruf besar/kecil) dan
     * tanggal lahirnya sama persis. Yang pertama menang.
     *
     * @param  list<array<string, string>>  $rows
     * @return array{0: list<array<string, string>>, 1: int}
     */
    private function mergeIdenticalRows(array $rows): array
    {
        $seen = [];
        $people = [];

        foreach ($rows as $row) {
            $key = mb_strtolower($row['nama']).'|'.$row['tanggal_lahir'];

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $people[] = $row;
        }

        return [$people, count($rows) - count($people)];
    }

    /**
     * Nomor kembar berarti datanya meragukan — dilewati agar tidak menggabung
     * dua orang yang berbeda. #ERROR! bukan nomor, jadi tidak dihitung kembar.
     *
     * @param  list<array<string, string>>  $people
     * @return array{0: list<array<string, string>>, 1: list<array<string, string>>}
     */
    private function skipDuplicatePhones(array $people): array
    {
        $counts = [];

        foreach ($people as $row) {
            $phone = User::normalizePhone($row['no_hp']);
            if ($phone !== null) {
                $counts[$phone] = ($counts[$phone] ?? 0) + 1;
            }
        }

        $importable = [];
        $skipped = [];

        foreach ($people as $row) {
            $phone = User::normalizePhone($row['no_hp']);

            if ($phone !== null && $counts[$phone] > 1) {
                $skipped[] = $row;

                continue;
            }

            $importable[] = $row;
        }

        return [$importable, $skipped];
    }

    /**
     * @param  array<string, string>  $row
     * @return array{0: array<string, mixed>, 1: bool}
     */
    private function mapRow(array $row): array
    {
        $birthDate = CarbonImmutable::parse($row['tanggal_lahir']);
        $masuk = ctype_digit($row['masuk']) ? (int) $row['masuk'] : null;

        // Lahir setelah masuk pesantren, atau umur di bawah 10 tahun: tanggalnya
        // keliru, jadi tidak dipakai membentuk sandi.
        $dateIsSane = $birthDate->year > 1950
            && $birthDate->isBefore(now()->subYears(10))
            && ($masuk === null || $birthDate->year < $masuk);

        return [[
            'name' => $row['nama'],
            'email' => null,
            'phone' => User::normalizePhone($row['no_hp']),
            'password' => Hash::make($dateIsSane ? $birthDate->format('Ymd') : self::FALLBACK_PASSWORD),
            'must_change_password' => true,
            'is_active' => true,

            'birth_place' => $this->clean($row['tempat_lahir']),
            'birth_date' => $birthDate->toDateString(),

            'angkatan' => ctype_digit($row['keluar']) ? (int) $row['keluar'] : null,
            'tahun_masuk' => $masuk,
            'is_mondok' => $row['mondok'] === 'mondok',

            'kesibukan' => $this->clean($row['kesibukan']),
            'nama_instansi' => $this->clean($row['nama_instansi']),

            'alamat' => $this->clean($row['alamat_lengkap']),
            'desa' => $this->clean($row['desa_lengkap']),
            'kecamatan' => $this->clean($row['kecamatan_lengkap']),
            'kota' => $this->clean($row['kota_lengkap']),
            'provinsi' => $this->clean($row['provinsi_lengkap']),

            'alamat_domisili' => $this->clean($row['alamat_domisili']),
            'desa_domisili' => $this->clean($row['desa_domisili']),
            'kecamatan_domisili' => $this->clean($row['kecamatan_domisili']),
            'kota_domisili' => $this->clean($row['kota_domisili']),
            'provinsi_domisili' => $this->clean($row['provinsi_domisili']),
        ], ! $dateIsSane];
    }

    /** Nilai error spreadsheet bukan data — dibuang jadi null. */
    private function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '' || (str_starts_with($value, '#') && str_ends_with($value, '!'))) {
            return null;
        }

        return $value;
    }

    /** @param array<string, mixed> $attributes */
    private function findExisting(array $attributes): ?User
    {
        if ($attributes['phone'] !== null) {
            return User::where('phone', $attributes['phone'])->first();
        }

        return User::where('name', $attributes['name'])
            ->where('birth_date', $attributes['birth_date'])
            ->first();
    }

    /** @param list<array<string, string>> $importable */
    private function previewSample(array $importable): void
    {
        $sample = array_slice($importable, 0, 3);

        $this->table(
            ['nama', 'phone', 'lahir', 'sandi', 'angkatan', 'kota domisili'],
            array_map(function (array $row) {
                [$attributes, $fallback] = $this->mapRow($row);

                return [
                    $attributes['name'],
                    $attributes['phone'] ?? '(kosong)',
                    $attributes['birth_date'],
                    $fallback ? self::FALLBACK_PASSWORD : str_replace('-', '', $attributes['birth_date']),
                    $attributes['angkatan'],
                    $attributes['kota_domisili'] ?? '-',
                ];
            }, $sample),
        );
    }
}
