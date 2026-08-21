<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Auth;

/**
 * Mengisi created_by / updated_by / deleted_by otomatis.
 * Satu tempat, supaya tidak diulang di tiap model.
 */
trait HasAudit
{
    public static function bootHasAudit(): void
    {
        static::creating(function ($model) {
            $model->created_by ??= Auth::id();
            $model->updated_by ??= Auth::id();
        });

        static::updating(function ($model) {
            $model->updated_by = Auth::id();
        });

        static::deleting(function ($model) {
            // Hanya berlaku untuk model ber-SoftDeletes; hard delete tidak
            // menyimpan apa pun untuk dicatat.
            if (in_array('deleted_by', $model->getFillable(), true) && ! $model->isForceDeleting()) {
                $model->deleted_by = Auth::id();
                $model->saveQuietly();
            }
        });
    }
}
