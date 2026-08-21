<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MenuItem extends Model
{
    use HasAudit, HasUuids;

    protected $fillable = [
        'parent_id',
        'title',
        'icon',
        'route_name',
        'url',
        'description',
        'order',
        'active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'order' => 'integer',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('order');
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'menu_items_role', 'menu_item_id', 'role_id')
            ->withPivot(['id', 'is_active'])
            ->withTimestamps();
    }
}
