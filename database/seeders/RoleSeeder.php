<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * '*' berarti seluruh permission. Selain itu daftar eksplisit —
     * sengaja tidak memakai wildcard parsial agar penambahan permission baru
     * tidak diam-diam melebarkan akses peran yang sudah ada.
     */
    public static function definitions(): array
    {
        $tulisSendiri = [
            'view dashboard',
            'view article', 'create article', 'store article',
            'edit article', 'update article', 'submit article',
            'view media', 'upload media',
            'view category',
        ];

        return [
            'Super Admin' => [
                'order' => 1,
                'description' => 'Akses penuh, termasuk peran dan menu panel.',
                'permissions' => '*',
            ],
            'Pemimpin Redaksi' => [
                'order' => 2,
                'description' => 'Menerbitkan, menjadwalkan, mengarsipkan, dan mengelola pengguna.',
                'permissions' => [
                    'view dashboard',
                    'view article', 'view article-all', 'create article', 'store article',
                    'edit article', 'update article', 'delete article', 'submit article',
                    'review article', 'publish article', 'schedule article', 'archive article',
                    'view category', 'create category', 'update category', 'delete category',
                    'view media', 'upload media', 'delete media',
                    'view user', 'update user', 'invite user', 'deactivate user',
                    'view role',
                ],
            ],
            'Redaktur' => [
                'order' => 3,
                'description' => 'Mereview draf: menerima atau mengembalikan, serta menyunting semua artikel.',
                'permissions' => [
                    'view dashboard',
                    'view article', 'view article-all', 'create article', 'store article',
                    'edit article', 'update article', 'submit article', 'review article',
                    'view category',
                    'view media', 'upload media',
                ],
            ],
            'Penulis' => [
                'order' => 4,
                'description' => 'Menulis dan mengajukan draf sendiri.',
                'permissions' => array_merge($tulisSendiri, ['delete article']),
            ],
            'Kontributor' => [
                'order' => 5,
                'description' => 'Menulis dan mengajukan draf sendiri, tanpa hak menghapus.',
                'permissions' => $tulisSendiri,
            ],
            // Alumni yang punya akun tapi tidak menulis. Sengaja dimulai dari
            // hampir nol — hak tambahannya diberikan lewat modul Hak Akses,
            // bukan dengan menambah daftar di sini.
            'Anggota' => [
                'order' => 6,
                'description' => 'Alumni terdaftar yang tidak menulis. Hanya membuka panel; hak lain diatur lewat Hak Akses.',
                'permissions' => ['view dashboard'],
            ],
        ];
    }

    public function run(): void
    {
        $all = Permission::pluck('name')->all();

        foreach (self::definitions() as $name => $config) {
            $role = Role::updateOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                [
                    'description' => $config['description'],
                    'order' => $config['order'],
                    'is_system' => true,
                ],
            );

            $permissions = $config['permissions'] === '*' ? $all : $config['permissions'];

            $unknown = array_diff($permissions, $all);
            if ($unknown !== []) {
                throw new \RuntimeException(
                    "Peran [{$name}] merujuk permission yang belum di-seed: " . implode(', ', $unknown)
                );
            }

            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
