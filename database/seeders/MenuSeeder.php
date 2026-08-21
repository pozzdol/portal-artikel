<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Menu panel admin. Tiap item ditautkan ke peran yang boleh melihatnya —
 * pola menu_items + menu_items_role dari HSE.
 */
class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $tree = [
            [
                'title' => 'Dashboard',
                'icon' => 'layout-dashboard',
                'route_name' => 'admin.dashboard',
                'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur', 'Penulis', 'Kontributor', 'Anggota'],
            ],
            [
                'title' => 'Redaksi',
                'icon' => 'news',
                'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur', 'Penulis', 'Kontributor'],
                'children' => [
                    [
                        'title' => 'Artikel',
                        'icon' => 'article',
                        'route_name' => 'admin.articles.index',
                        'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur', 'Penulis', 'Kontributor'],
                    ],
                    [
                        'title' => 'Antrean Review',
                        'icon' => 'checklist',
                        'route_name' => 'admin.articles.review',
                        'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur'],
                    ],
                    [
                        'title' => 'Rubrik',
                        'icon' => 'category',
                        'route_name' => 'admin.categories.index',
                        'roles' => ['Super Admin', 'Pemimpin Redaksi'],
                    ],
                    [
                        'title' => 'Media',
                        'icon' => 'photo',
                        'route_name' => 'admin.media.index',
                        'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur', 'Penulis', 'Kontributor'],
                    ],
                ],
            ],
            [
                'title' => 'Pengaturan',
                'icon' => 'settings',
                'roles' => ['Super Admin', 'Pemimpin Redaksi'],
                'children' => [
                    [
                        'title' => 'Pengguna',
                        'icon' => 'users',
                        'route_name' => 'admin.users.index',
                        'roles' => ['Super Admin', 'Pemimpin Redaksi'],
                    ],
                    [
                        'title' => 'Peran & Hak Akses',
                        'icon' => 'shield-lock',
                        'route_name' => 'admin.roles.index',
                        'roles' => ['Super Admin'],
                    ],
                    [
                        'title' => 'Menu Panel',
                        'icon' => 'menu-2',
                        'route_name' => 'admin.menus.index',
                        'roles' => ['Super Admin'],
                    ],
                ],
            ],
            // Level atas, bukan di bawah Pengaturan: kalau ditaruh di sana,
            // Penulis melihat header "Pengaturan" hanya untuk menampung satu item.
            [
                'title' => 'Profil Saya',
                'icon' => 'user-circle',
                'route_name' => 'admin.profile.edit',
                'roles' => ['Super Admin', 'Pemimpin Redaksi', 'Redaktur', 'Penulis', 'Kontributor', 'Anggota'],
            ],
        ];

        $roles = Role::pluck('id', 'name');

        $this->seedLevel($tree, $roles, null);
    }

    private function seedLevel(array $items, $roles, ?string $parentId): void
    {
        foreach ($items as $order => $item) {
            $menu = MenuItem::updateOrCreate(
                ['title' => $item['title'], 'parent_id' => $parentId],
                [
                    'icon' => $item['icon'] ?? null,
                    'route_name' => $item['route_name'] ?? null,
                    'order' => $order + 1,
                    'active' => true,
                ],
            );

            $menu->roles()->sync(
                collect($item['roles'])
                    ->filter(fn ($name) => $roles->has($name))
                    ->mapWithKeys(fn ($name) => [
                        $roles[$name] => ['id' => (string) \Illuminate\Support\Str::uuid(), 'is_active' => true],
                    ])
                    ->all()
            );

            if (! empty($item['children'])) {
                $this->seedLevel($item['children'], $roles, $menu->id);
            }
        }
    }
}
