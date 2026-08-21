<?php

namespace App\Enums;

enum ArticleStatus: string
{
    case Draft = 'draft';
    case Returned = 'returned';
    case InReview = 'in_review';
    case Scheduled = 'scheduled';
    case Published = 'published';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Returned => 'Dikembalikan',
            self::InReview => 'Menunggu Review',
            self::Scheduled => 'Terjadwal',
            self::Published => 'Terbit',
            self::Archived => 'Arsip',
        };
    }

    /** Status yang boleh dilihat pembaca umum. */
    public function isPublic(): bool
    {
        return $this === self::Published;
    }
}
