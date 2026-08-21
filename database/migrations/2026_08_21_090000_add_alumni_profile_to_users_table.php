<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Anggota hasil impor tidak punya email. Login menerima dua
            // kredensial, jadi salah satunya boleh kosong — tapi tidak keduanya
            // (dijaga di lapisan aplikasi, bukan di sini).
            $table->string('email')->nullable()->change();
            $table->string('phone', 20)->nullable()->unique()->after('email');

            // Sandi awal diturunkan dari tanggal lahir, jadi sekali pakai.
            $table->boolean('must_change_password')->default(false)->after('password');

            // Kelahiran
            $table->string('birth_place')->nullable()->after('bio');
            $table->date('birth_date')->nullable()->after('birth_place');

            // Riwayat pesantren. `angkatan` yang sudah ada dipakai untuk tahun
            // KELUAR (lulus); tahun masuk ditambah di sini.
            $table->smallInteger('tahun_masuk')->nullable()->after('angkatan');
            $table->boolean('is_mondok')->nullable()->after('tahun_masuk');

            // Kesibukan
            $table->string('kesibukan')->nullable()->after('is_mondok');
            $table->string('nama_instansi')->nullable()->after('kesibukan');

            // Alamat asal
            $table->string('alamat')->nullable()->after('nama_instansi');
            $table->string('desa')->nullable()->after('alamat');
            $table->string('kecamatan')->nullable()->after('desa');
            $table->string('kota')->nullable()->after('kecamatan');
            $table->string('provinsi')->nullable()->after('kota');

            // Alamat domisili
            $table->string('alamat_domisili')->nullable()->after('provinsi');
            $table->string('desa_domisili')->nullable()->after('alamat_domisili');
            $table->string('kecamatan_domisili')->nullable()->after('desa_domisili');
            $table->string('kota_domisili')->nullable()->after('kecamatan_domisili');
            $table->string('provinsi_domisili')->nullable()->after('kota_domisili');

            $table->index('angkatan', 'users_angkatan_index_alumni');
            $table->index('kota_domisili');
        });

        // `domisili` digantikan kota_domisili + provinsi_domisili yang
        // terstruktur. Dua sumber untuk fakta yang sama pasti akan berbeda.
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('domisili');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('domisili')->nullable();
            $table->dropIndex('users_angkatan_index_alumni');
            $table->dropIndex(['kota_domisili']);
            $table->dropUnique(['phone']);
            $table->dropColumn([
                'phone', 'must_change_password', 'birth_place', 'birth_date',
                'tahun_masuk', 'is_mondok', 'kesibukan', 'nama_instansi',
                'alamat', 'desa', 'kecamatan', 'kota', 'provinsi',
                'alamat_domisili', 'desa_domisili', 'kecamatan_domisili',
                'kota_domisili', 'provinsi_domisili',
            ]);
            $table->string('email')->nullable(false)->change();
        });
    }
};
