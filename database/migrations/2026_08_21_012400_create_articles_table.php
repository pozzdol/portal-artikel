<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('body')->nullable();

            $table->uuid('category_id');
            $table->uuid('author_id');
            $table->uuid('cover_media_id')->nullable();

            // draft · returned · in_review · scheduled · published · archived
            $table->string('status', 20)->default('draft');
            // Waktu tayang. Terisi saat dijadwalkan maupun saat terbit,
            // sehingga satu kolom melayani kedua kasus.
            $table->timestamp('published_at')->nullable();

            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            // Alasan redaktur mengembalikan draf — tanpa ini penulis tidak tahu
            // apa yang harus diperbaiki.
            $table->text('review_note')->nullable();

            $table->unsignedBigInteger('views')->default(0);

            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->uuid('deleted_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['category_id', 'status']);
            $table->index('author_id');

            $table->foreign('category_id')->references('id')->on('categories')->restrictOnDelete();
            $table->foreign('author_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('cover_media_id')->references('id')->on('media')->nullOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
