<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use HasAudit, HasUuids, SoftDeletes;

    protected $fillable = [
        'name',
        'guard_name',
        'description',
        'is_system',
        'order',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'order' => 'integer',
        ];
    }

    public function menuItems()
    {
        return $this->belongsToMany(MenuItem::class, 'menu_items_role', 'role_id', 'menu_item_id')
            ->withPivot(['id', 'is_active'])
            ->withTimestamps();
    }
}
