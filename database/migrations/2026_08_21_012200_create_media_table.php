<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Satu tabel datar: sampul artikel, gambar isi, foto penulis, sampul rubrik.
        // Tanpa folder dan tanpa tag — ditambah kalau memang terbukti perlu.
        Schema::create('media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('disk')->default('public');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            // Wajib diisi saat unggah — tanpa ini gambar tidak terbaca pembaca layar.
            $table->string('alt')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();

            $table->index('mime_type');
            $table->index('created_by');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('photo_media_id')->references('id')->on('media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['photo_media_id']);
        });

        Schema::dropIfExists('media');
    }
};
