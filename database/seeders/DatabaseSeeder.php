<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
            MenuSeeder::class,
            CategorySeeder::class,
        ]);

        // Akun admin awal. Tidak ada pendaftaran publik di panel ini —
        // pengguna berikutnya dibuat dari dalam panel.
        $superAdmin = Role::where('name', 'Super Admin')->firstOrFail();

        $admin = User::updateOrCreate(
            ['email' => 'admin@almaidah.id'],
            [
                'name' => 'Administrator',
                'password' => 'password',
                'is_active' => true,
                'default_role_id' => $superAdmin->id,
                'email_verified_at' => now(),
            ],
        );

        $admin->syncRoles([$superAdmin]);
    }
}
