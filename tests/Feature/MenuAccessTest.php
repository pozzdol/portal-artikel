<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\MenuService;
use Database\Seeders\MenuSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuAccessTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $roleName): User
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, MenuSeeder::class]);
        $role = Role::where('name', $roleName)->firstOrFail();

        $user = User::create([
            'name' => $roleName,
            'email' => str($roleName)->slug() . '@almaidah.id',
            'password' => 'rahasia-sekali',
            'is_active' => true,
            'default_role_id' => $role->id,
        ]);

        $user->syncRoles([$role]);

        return $user;
    }

    /** @return list<string> */
    private function titles(array $nodes): array
    {
        $out = [];
        foreach ($nodes as $node) {
            $out[] = $node['title'];
            $out = array_merge($out, $this->titles($node['children']));
        }

        return $out;
    }

    public function test_super_admin_melihat_seluruh_menu(): void
    {
        $titles = $this->titles(app(MenuService::class)->forUser($this->userWithRole('Super Admin')));

        $this->assertContains('Peran & Hak Akses', $titles);
        $this->assertContains('Antrean Review', $titles);
        $this->assertCount(10, $titles);
    }

    public function test_penulis_tidak_melihat_menu_pengaturan(): void
    {
        $titles = $this->titles(app(MenuService::class)->forUser($this->userWithRole('Penulis')));

        $this->assertContains('Artikel', $titles);
        $this->assertNotContains('Pengaturan', $titles);
        $this->assertNotContains('Antrean Review', $titles);
        $this->assertNotContains('Peran & Hak Akses', $titles);
    }

    public function test_induk_ikut_tampil_agar_anak_tidak_yatim(): void
    {
        // Penulis tidak ditugaskan ke "Redaksi" secara langsung, tapi anaknya
        // ya — induknya harus tetap muncul supaya menu tidak kosong.
        $titles = $this->titles(app(MenuService::class)->forUser($this->userWithRole('Penulis')));

        $this->assertContains('Redaksi', $titles);
    }

    public function test_tanpa_peran_menu_kosong(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, MenuSeeder::class]);

        $user = User::create([
            'name' => 'Tanpa Peran',
            'email' => 'tanpa@almaidah.id',
            'password' => 'rahasia-sekali',
            'is_active' => true,
        ]);

        $this->assertSame([], app(MenuService::class)->forUser($user));
        $this->assertSame([], app(MenuService::class)->forUser(null));
    }
}
