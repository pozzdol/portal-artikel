<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Category extends Model
{
    use HasAudit, HasUuids, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_nav',
        'is_active',
        'order',
        'cover_media_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'is_nav' => 'boolean',
            'is_active' => 'boolean',
            'order' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Rubrik yang tampil di navbar publik, sudah terurut. */
    public function scopeForNav(Builder $query): Builder
    {
        return $query->where('is_nav', true)->where('is_active', true)->orderBy('order');
    }

    public function articles()
    {
        return $this->hasMany(Article::class);
    }

    public function cover()
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }
}
