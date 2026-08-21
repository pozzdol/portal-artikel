<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

/**
 * Sumber tunggal daftar permission. Idempoten — aman dijalankan berulang.
 * Penamaan mengikuti HSE: "{verb} {resource}".
 */
class PermissionSeeder extends Seeder
{
    /** @return array<string, array<string, string>> group => [name => description] */
    public static function definitions(): array
    {
        return [
            'Artikel' => [
                'view article' => 'Melihat daftar dan detail artikel',
                'create article' => 'Membuka form artikel baru',
                'store article' => 'Menyimpan artikel baru',
                'edit article' => 'Membuka form sunting artikel',
                'update article' => 'Menyimpan perubahan artikel',
                'delete article' => 'Menghapus artikel',
                'submit article' => 'Mengajukan draf untuk direview',
                'review article' => 'Menerima atau mengembalikan draf',
                'publish article' => 'Menerbitkan artikel',
                'schedule article' => 'Menjadwalkan waktu tayang artikel',
                'archive article' => 'Mengarsipkan artikel yang sudah terbit',
                'view article-all' => 'Melihat artikel milik semua penulis, bukan hanya sendiri',
            ],
            'Rubrik' => [
                'view category' => 'Melihat daftar rubrik',
                'create category' => 'Menambah rubrik',
                'update category' => 'Menyunting rubrik, termasuk tampil di navbar',
                'delete category' => 'Menghapus rubrik',
            ],
            'Media' => [
                'view media' => 'Melihat pustaka media',
                'upload media' => 'Mengunggah berkas media',
                'delete media' => 'Menghapus berkas media',
            ],
            'Pengguna' => [
                'view user' => 'Melihat daftar pengguna',
                'create user' => 'Menambah pengguna',
                'update user' => 'Menyunting pengguna',
                'delete user' => 'Menonaktifkan atau menghapus pengguna',
            ],
            'Hak Akses' => [
                'view role' => 'Melihat daftar peran',
                'create role' => 'Menambah peran',
                'update role' => 'Menyunting peran dan hak aksesnya',
                'delete role' => 'Menghapus peran',
                'view menu' => 'Melihat pengaturan menu panel',
                'manage menu' => 'Mengatur menu panel dan aksesnya per peran',
            ],
        ];
    }

    public function run(): void
    {
        foreach (self::definitions() as $group => $permissions) {
            foreach ($permissions as $name => $description) {
                Permission::updateOrCreate(
                    ['name' => $name, 'guard_name' => 'web'],
                    ['group' => $group, 'description' => $description],
                );
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
