<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            // is_nav menentukan rubrik mana yang muncul di navbar publik,
            // supaya navbar dan daftar rubrik tidak pernah berbeda.
            $table->boolean('is_nav')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('order')->default(0);
            $table->uuid('cover_media_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->uuid('deleted_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_nav', 'is_active', 'order']);
            $table->foreign('cover_media_id')->references('id')->on('media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
