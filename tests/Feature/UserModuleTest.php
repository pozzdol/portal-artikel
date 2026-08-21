<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Notifications\UserInvitation;
use App\Services\MenuService;
use Database\Seeders\MenuSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class, MenuSeeder::class]);
    }

    private function role(string $name): Role
    {
        return Role::where('name', $name)->firstOrFail();
    }

    private function userWith(array $roleNames, ?string $active = null): User
    {
        $roles = collect($roleNames)->map(fn ($n) => $this->role($n));

        $user = User::create([
            'name' => 'Uji '.Str::random(6),
            'email' => Str::random(8).'@almaidah.id',
            'password' => 'rahasia-sekali',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $user->syncRoles($roles->all());
        $user->forceFill(['default_role_id' => $this->role($active ?? $roleNames[0])->id])->save();

        return $user->refresh()->load('roles', 'defaultRole');
    }

    /* Aturan inti: hak akses hanya dari peran aktif ------------------------ */

    public function test_permission_hanya_dari_peran_aktif_bukan_gabungan(): void
    {
        $user = $this->userWith(['Penulis', 'Redaktur'], active: 'Penulis');

        $this->assertTrue($user->can('submit article'));
        $this->assertFalse($user->can('review article'), 'Redaktur dipegang tapi tidak aktif — tidak boleh lolos.');
        $this->assertFalse($user->hasPermissionTo('review article'), 'Panggilan langsung juga harus ikut aturan.');
        $this->assertSame(
            $this->role('Penulis')->permissions()->count(),
            $user->getAllPermissions()->count(),
        );
    }

    public function test_ganti_peran_aktif_mengubah_hak_akses(): void
    {
        $user = $this->userWith(['Penulis', 'Redaktur'], active: 'Penulis');

        $this->actingAs($user)
            ->put('/admin/peran-aktif', ['role_id' => $this->role('Redaktur')->id])
            ->assertRedirect();

        $this->assertTrue($user->refresh()->load('roles', 'defaultRole')->can('review article'));
    }

    public function test_tidak_bisa_pindah_ke_peran_yang_tidak_dipegang(): void
    {
        $user = $this->userWith(['Penulis']);

        $this->actingAs($user)
            ->put('/admin/peran-aktif', ['role_id' => $this->role('Super Admin')->id])
            ->assertSessionHasErrors('role_id');

        $this->assertSame('Penulis', $user->refresh()->activeRole()->name);
    }

    public function test_menu_mengikuti_peran_aktif_bukan_semua_peran(): void
    {
        $user = $this->userWith(['Super Admin', 'Redaktur'], active: 'Redaktur');

        $titles = collect(app(MenuService::class)->forUser($user))
            ->flatMap(fn ($n) => [$n['title'], ...collect($n['children'])->pluck('title')]);

        $this->assertContains('Antrean Review', $titles);
        $this->assertNotContains('Pengguna', $titles, 'Menu tidak boleh menampilkan yang akan ditolak 403.');
    }

    /* Peran Anggota -------------------------------------------------------- */

    public function test_anggota_hanya_bisa_membuka_dashboard(): void
    {
        $user = $this->userWith(['Anggota']);

        $this->actingAs($user)->get('/admin')->assertOk();
        $this->actingAs($user)->get('/admin/pengguna')->assertForbidden();
        $this->actingAs($user)->get('/admin/profil')->assertOk();

        $titles = collect(app(MenuService::class)->forUser($user))
            ->flatMap(fn ($n) => [$n['title'], ...collect($n['children'])->pluck('title')]);

        $this->assertEqualsCanonicalizing(['Dashboard', 'Profil Saya'], $titles->all());
    }

    /* Undangan ------------------------------------------------------------- */

    public function test_undangan_membuat_akun_nonaktif_dan_mengirim_tautan(): void
    {
        Notification::fake();
        $admin = $this->userWith(['Super Admin']);
        $penulis = $this->role('Penulis');

        $this->actingAs($admin)->post('/admin/pengguna', [
            'name' => 'Rian Reporter',
            'email' => 'rian@almaidah.id',
            'role_ids' => [$penulis->id],
            'default_role_id' => $penulis->id,
        ])->assertRedirect('/admin/pengguna');

        $invited = User::where('email', 'rian@almaidah.id')->firstOrFail();

        $this->assertFalse($invited->is_active);
        $this->assertNull($invited->email_verified_at);
        $this->assertSame('rian-reporter', $invited->slug);
        Notification::assertSentTo($invited, UserInvitation::class);
    }

    public function test_menerima_undangan_mengaktifkan_akun(): void
    {
        $invited = User::create([
            'name' => 'Belum Aktif',
            'email' => 'belum@almaidah.id',
            'password' => Str::random(64),
            'is_active' => false,
        ]);
        $invited->syncRoles([$this->role('Penulis')]);

        $this->post('/admin/reset-password', [
            'token' => Password::broker()->createToken($invited),
            'email' => $invited->email,
            'password' => 'sandi-baru-kuat',
            'password_confirmation' => 'sandi-baru-kuat',
        ])->assertRedirect('/admin/login');

        $invited->refresh();
        $this->assertTrue($invited->is_active);
        $this->assertNotNull($invited->email_verified_at);
    }

    public function test_reset_sandi_tidak_mengaktifkan_akun_yang_dinonaktifkan(): void
    {
        $user = $this->userWith(['Penulis']);
        $user->update(['is_active' => false]);

        $this->post('/admin/reset-password', [
            'token' => Password::broker()->createToken($user),
            'email' => $user->email,
            'password' => 'sandi-baru-kuat',
            'password_confirmation' => 'sandi-baru-kuat',
        ]);

        $this->assertFalse($user->refresh()->is_active, 'Nonaktif harus tetap nonaktif setelah reset sandi.');
    }

    /* Penjagaan ------------------------------------------------------------ */

    public function test_peran_aktif_wajib_salah_satu_yang_dipilih(): void
    {
        $admin = $this->userWith(['Super Admin']);

        $this->actingAs($admin)->post('/admin/pengguna', [
            'name' => 'Salah Setel',
            'email' => 'salah@almaidah.id',
            'role_ids' => [$this->role('Penulis')->id],
            'default_role_id' => $this->role('Redaktur')->id,
        ])->assertSessionHasErrors('default_role_id');

        $this->assertDatabaseMissing('users', ['email' => 'salah@almaidah.id']);
    }

    public function test_tidak_bisa_menonaktifkan_akun_sendiri(): void
    {
        $admin = $this->userWith(['Super Admin']);

        $this->actingAs($admin)
            ->patch("/admin/pengguna/{$admin->slug}/status")
            ->assertSessionHasErrors('is_active');

        $this->assertTrue($admin->refresh()->is_active);
    }

    public function test_penulis_bisa_menyunting_profil_sendiri_tanpa_permission_pengguna(): void
    {
        $user = $this->userWith(['Penulis']);
        $this->assertFalse($user->can('update user'));

        $this->actingAs($user)->put('/admin/profil', [
            'name' => 'Rian Anshori',
            'email' => $user->email,
            'pen_name' => 'Rian A.',
            'angkatan' => 2005,
            'phone' => null,
            'kota_domisili' => 'KABUPATEN SUMEDANG',
        ])->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('Rian A.', $user->pen_name);
        $this->assertSame('rian-a', $user->slug, 'Slug ikut nama pena.');
    }

    public function test_penulis_tidak_bisa_membuka_daftar_pengguna(): void
    {
        $this->actingAs($this->userWith(['Penulis']))
            ->get('/admin/pengguna')
            ->assertForbidden();
    }

    /* Impor alumni & login dua kredensial ---------------------------------- */

    public function test_nomor_hp_dibakukan_ke_satu_bentuk(): void
    {
        $this->assertSame('82111614532', User::normalizePhone('082111614532'));
        $this->assertSame('82111614532', User::normalizePhone('+62 821-1161-4532'));
        $this->assertSame('82111614532', User::normalizePhone('6282111614532'));
        $this->assertNull(User::normalizePhone('#ERROR!'));
        $this->assertNull(User::normalizePhone(''));
    }

    public function test_bisa_masuk_dengan_nomor_hp_maupun_email(): void
    {
        $user = $this->userWith(['Anggota']);
        $user->forceFill(['phone' => '82111614532', 'password' => bcrypt('20040224')])->save();

        $this->postJson('/admin/login/check', ['login' => '082111614532'])
            ->assertJson(['registered' => true]);

        $this->post('/admin/login', ['login' => '+6282111614532', 'password' => '20040224'])
            ->assertRedirect();
        $this->assertAuthenticatedAs($user);
    }

    public function test_akun_wajib_ganti_sandi_ditahan_di_halaman_ganti_sandi(): void
    {
        $user = $this->userWith(['Anggota']);
        $user->forceFill(['must_change_password' => true])->save();

        $this->actingAs($user)->get('/admin')->assertRedirect('/admin/ganti-sandi');
        $this->actingAs($user)->get('/admin/ganti-sandi')->assertOk();
    }

    public function test_setelah_ganti_sandi_panel_terbuka(): void
    {
        $user = $this->userWith(['Anggota']);
        $user->forceFill(['must_change_password' => true, 'password' => bcrypt('20040224')])->save();

        $this->actingAs($user)->put('/admin/ganti-sandi', [
            'current_password' => '20040224',
            'password' => 'sandi-baru-kuat',
            'password_confirmation' => 'sandi-baru-kuat',
        ])->assertRedirect('/admin');

        $this->assertFalse($user->refresh()->must_change_password);
        $this->actingAs($user)->get('/admin')->assertOk();
    }

    public function test_impor_alumni_menghormati_aturan_duplikat(): void
    {
        $csv = tempnam(sys_get_temp_dir(), 'alumni').'.csv';
        file_put_contents($csv, implode("\n", [
            'id,no_hp,password,role,nama,alamat_lengkap,desa_lengkap,kecamatan_lengkap,kota_lengkap,provinsi_lengkap,tempat_lahir,tanggal_lahir,masuk,keluar,mondok,kesibukan,nama_instansi,alamat_domisili,desa_domisili,kecamatan_domisili,kota_domisili,provinsi_domisili',
            'a,8211111,x,user,Ahmad Satu,Jl A,DESA,KEC,KOTA,JABAR,Sumedang,2000-01-02,2012,2015,mondok,kuliah,Kampus,Jl A,DESA,KEC,KOTA,JABAR',
            'b,8211111,x,user,ahmad satu,Jl A,DESA,KEC,KOTA,JABAR,Sumedang,2000-01-02,2012,2015,mondok,kuliah,Kampus,Jl A,DESA,KEC,KOTA,JABAR',
            'c,8222222,x,user,Budi Kembar,Jl B,DESA,KEC,KOTA,JABAR,Sumedang,2001-03-04,2013,2016,mondok,bekerja,PT B,Jl B,DESA,KEC,KOTA,JABAR',
            'd,8222222,x,user,Budi Lain,Jl B,DESA,KEC,KOTA,JABAR,Sumedang,2001-03-05,2013,2016,mondok,bekerja,PT B,Jl B,DESA,KEC,KOTA,JABAR',
            'e,#ERROR!,x,user,Tanpa Nomor,Jl C,DESA,KEC,KOTA,JABAR,Sumedang,2002-05-06,2014,2017,tidak_mondok,bekerja,PT C,Jl C,DESA,KEC,KOTA,JABAR',
            'f,#ERROR!,x,user,Tanpa Nomor Dua,Jl D,DESA,KEC,KOTA,JABAR,Sumedang,2003-07-08,2015,2018,mondok,kuliah,Kampus D,Jl D,DESA,KEC,KOTA,JABAR',
            'g,8233333,x,user,Tanggal Mustahil,Jl E,DESA,KEC,KOTA,JABAR,Sumedang,2025-05-23,2017,2022,mondok,kuliah,Kampus E,Jl E,DESA,KEC,KOTA,JABAR',
        ])."\n");

        $this->artisan('almaidah:import-alumni', ['file' => $csv])->assertSuccessful();

        // Ahmad: 2 baris identik -> 1 orang. Budi: nomor kembar -> keduanya dilewati.
        // Dua #ERROR! bukan duplikat -> keduanya masuk tanpa nomor.
        $this->assertDatabaseHas('users', ['name' => 'Ahmad Satu', 'phone' => '8211111']);
        $this->assertDatabaseMissing('users', ['name' => 'Budi Kembar']);
        $this->assertDatabaseMissing('users', ['name' => 'Budi Lain']);
        $this->assertSame(2, User::whereNull('phone')->whereNotNull('birth_date')->count());

        $ahmad = User::where('name', 'Ahmad Satu')->firstOrFail();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('20000102', $ahmad->password));
        $this->assertTrue($ahmad->must_change_password);
        $this->assertSame('Anggota', $ahmad->activeRole()->name);
        $this->assertSame(2015, $ahmad->angkatan, 'angkatan diisi dari kolom keluar');
        $this->assertSame(2012, $ahmad->tahun_masuk);

        // Tanggal lahir mustahil: sandi jatuh ke "password", bukan tanggalnya.
        $mustahil = User::where('name', 'Tanggal Mustahil')->firstOrFail();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('password', $mustahil->password));

        unlink($csv);
    }
}
