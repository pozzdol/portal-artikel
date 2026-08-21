<?php

namespace App\Models;

use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    use HasAudit, HasUuids;

    protected $fillable = [
        'name',
        'guard_name',
        'group',
        'description',
        'created_by',
        'updated_by',
    ];
}
