<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

/**
 * Tujuh rubrik yang saat ini ditulis manual di navbar publik.
 * is_nav = true berarti rubrik itu tampil di navbar.
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Kajian',  'slug' => 'kajian',  'description' => 'Kajian keislaman dan tulisan asatidz'],
            ['name' => 'Berita',  'slug' => 'berita',  'description' => 'Kabar terkini seputar pesantren dan alumni'],
            ['name' => 'Alumni',  'slug' => 'alumni',  'description' => 'Profil dan kabar tokoh alumni'],
            ['name' => 'Yayasan', 'slug' => 'yayasan', 'description' => 'Kegiatan dan pengumuman yayasan'],
            ['name' => 'Opini',   'slug' => 'opini',   'description' => 'Gagasan dan pandangan alumni'],
            ['name' => 'Agenda',  'slug' => 'agenda',  'description' => 'Jadwal kegiatan dan acara'],
            ['name' => 'Video',   'slug' => 'video',   'description' => 'Dokumentasi video kegiatan dan kajian'],
        ];

        foreach ($categories as $order => $category) {
            Category::updateOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'is_nav' => true,
                    'is_active' => true,
                    'order' => $order + 1,
                ],
            );
        }
    }
}
