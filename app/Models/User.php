<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\Permission\Contracts\Permission as PermissionContract;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasAudit, HasFactory, HasRoles, HasUuids, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'email',
        'phone',
        'email_verified_at',
        'password',
        'must_change_password',
        'is_active',
        'default_role_id',
        // Byline
        'pen_name',
        'bio',
        'photo_media_id',
        // Kontak publik
        'public_email',
        'instagram',
        'x_handle',
        // Kelahiran
        'birth_place',
        'birth_date',
        // Riwayat pesantren — `angkatan` adalah tahun KELUAR (lulus).
        'angkatan',
        'tahun_masuk',
        'is_mondok',
        // Kesibukan
        'kesibukan',
        'nama_instansi',
        // Alamat asal
        'alamat',
        'desa',
        'kecamatan',
        'kota',
        'provinsi',
        // Alamat domisili
        'alamat_domisili',
        'desa_domisili',
        'kecamatan_domisili',
        'kota_domisili',
        'provinsi_domisili',
        // Opsional
        'asatidz_title',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'is_mondok' => 'boolean',
            'birth_date' => 'date',
            'angkatan' => 'integer',
            'tahun_masuk' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $user) {
            if (blank($user->slug) || $user->isDirty(['name', 'pen_name'])) {
                $user->slug = $user->generateSlug();
            }
        });
    }

    /* Peran ---------------------------------------------------------------
       model_has_roles menyimpan SEMUA peran yang boleh dipakai; default_role_id
       menunjuk satu di antaranya sebagai peran aktif. Permission diambil hanya
       dari peran aktif — dua override di bawah yang menegakkannya. */

    public function defaultRole()
    {
        return $this->belongsTo(Role::class, 'default_role_id');
    }

    /** Peran aktif, jatuh ke peran pertama yang dipegang bila belum disetel. */
    public function activeRole(): ?Role
    {
        return $this->defaultRole ?? $this->roles->first();
    }

    public function canSwitchRole(): bool
    {
        return $this->roles->count() > 1;
    }

    /**
     * Spatie memeriksa gabungan semua peran. Dipersempit ke peran aktif saja.
     * Ini titik yang dipanggil Gate::before milik Spatie, sehingga can(), @can,
     * middleware permission:, dan hasPermissionTo() langsung semuanya ikut.
     */
    protected function hasPermissionViaRole(PermissionContract $permission): bool
    {
        $role = $this->activeRole();

        return $role !== null && $permission->roles->contains('id', $role->id);
    }

    /** Pasangan dari override di atas, untuk getAllPermissions(). */
    public function getPermissionsViaRoles(): Collection
    {
        return $this->activeRole()?->permissions->sort()->values() ?? collect();
    }

    /* Profil --------------------------------------------------------------- */

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Nama yang tampil di halaman artikel — nama pena kalau ada. */
    public function getBylineAttribute(): string
    {
        return $this->pen_name ?: $this->name;
    }

    /** Dipakai avatar inisial selama unggah foto belum dibangun. */
    public function getInitialsAttribute(): string
    {
        return Str::of($this->byline)
            ->explode(' ')
            ->filter()
            ->take(2)
            ->map(fn (string $word) => Str::upper(Str::substr($word, 0, 1)))
            ->join('');
    }

    protected function generateSlug(): string
    {
        $base = Str::slug($this->pen_name ?: $this->name) ?: 'pengguna';
        $slug = $base;
        $suffix = 2;

        while (static::withTrashed()
            ->where('slug', $slug)
            ->when($this->exists, fn ($q) => $q->whereKeyNot($this->getKey()))
            ->exists()
        ) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    /**
     * Nomor HP dibawa ke satu bentuk baku: hanya angka, tanpa awalan 0 atau 62.
     * Tanpa ini "0821...", "+62821...", dan "821..." jadi tiga orang berbeda.
     */
    public static function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);

        if ($digits === '') {
            return null;
        }

        $digits = preg_replace('/^62/', '', $digits);
        $digits = ltrim($digits, '0');

        return $digits === '' ? null : $digits;
    }

    public function setPhoneAttribute(?string $value): void
    {
        $this->attributes['phone'] = static::normalizePhone($value);
    }

    /** Dipakai alur masuk: kredensial boleh email atau nomor HP. */
    public static function findByLogin(string $login): ?self
    {
        $phone = static::normalizePhone($login);

        return static::query()
            ->where('email', $login)
            ->when($phone !== null, fn ($q) => $q->orWhere('phone', $phone))
            ->first();
    }

    public function photo()
    {
        return $this->belongsTo(Media::class, 'photo_media_id');
    }

    public function articles()
    {
        return $this->hasMany(Article::class, 'author_id');
    }
}
