<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasAudit, HasFactory, HasRoles, HasUuids, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
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
        // Alumni Darul Hikmah
        'angkatan',
        'domisili',
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
            'angkatan' => 'integer',
        ];
    }

    /** Nama yang tampil di halaman artikel — nama pena kalau ada. */
    public function getBylineAttribute(): string
    {
        return $this->pen_name ?: $this->name;
    }

    public function defaultRole()
    {
        return $this->belongsTo(Role::class, 'default_role_id');
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
