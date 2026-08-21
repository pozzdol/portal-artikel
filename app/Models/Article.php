<?php

namespace App\Models;

use App\Enums\ArticleStatus;
use App\Models\Concerns\HasAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Article extends Model
{
    use HasAudit, HasUuids, SoftDeletes;

    protected $fillable = [
        'title',
        'slug',
        'excerpt',
        'body',
        'category_id',
        'author_id',
        'cover_media_id',
        'status',
        'published_at',
        'reviewed_by',
        'reviewed_at',
        'review_note',
        'views',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => ArticleStatus::class,
            'published_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'views' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Apa yang boleh dibaca publik. Artikel terjadwal ikut tampil begitu
     * waktunya lewat, sehingga tanpa cron pun halaman publik tetap benar —
     * yang tertinggal hanya label status di panel.
     */
    public function scopeLive(Builder $query): Builder
    {
        return $query
            ->whereIn('status', [ArticleStatus::Published, ArticleStatus::Scheduled])
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function cover()
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }
}
