<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $roleName = 'Super Admin'): User
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
        $role = Role::where('name', $roleName)->firstOrFail();

        $user = User::create([
            'name' => 'Uji Admin',
            'email' => 'uji@almaidah.id',
            'password' => 'rahasia-sekali',
            'is_active' => true,
            'default_role_id' => $role->id,
        ]);

        $user->syncRoles([$role]);

        return $user;
    }

    public function test_tamu_diarahkan_ke_halaman_masuk(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');
    }

    public function test_tahap_satu_membedakan_email_terdaftar(): void
    {
        $this->admin();

        $this->postJson('/admin/login/check', ['login' => 'uji@almaidah.id'])
            ->assertOk()
            ->assertJson(['registered' => true]);

        $this->postJson('/admin/login/check', ['login' => 'bukan@contoh.com'])
            ->assertOk()
            ->assertJson(['registered' => false]);
    }

    public function test_akun_nonaktif_tidak_dianggap_terdaftar_dan_tidak_bisa_masuk(): void
    {
        $user = $this->admin();
        $user->update(['is_active' => false]);

        $this->postJson('/admin/login/check', ['login' => $user->email])
            ->assertJson(['registered' => false]);

        $this->post('/admin/login', ['login' => $user->email, 'password' => 'rahasia-sekali'])
            ->assertSessionHasErrors('password');

        $this->assertGuest();
    }

    public function test_sandi_salah_ditolak(): void
    {
        $user = $this->admin();

        $this->post('/admin/login', ['login' => $user->email, 'password' => 'salah'])
            ->assertSessionHasErrors('password');

        $this->assertGuest();
    }

    public function test_sandi_benar_masuk_ke_dashboard(): void
    {
        $user = $this->admin();

        $this->post('/admin/login', ['login' => $user->email, 'password' => 'rahasia-sekali'])
            ->assertRedirect('/admin');

        $this->assertAuthenticatedAs($user);
        $this->get('/admin')->assertOk();
    }
}
