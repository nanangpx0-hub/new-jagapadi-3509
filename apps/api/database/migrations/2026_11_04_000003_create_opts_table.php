<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->string('scientific_name', 200)->nullable();
            $table->string('local_name', 200)->nullable();
            $table->string('category', 50)->default('hama'); // hama, penyakit, gulma
            $table->string('danger_level', 50)->nullable()->default('Sedang'); // Rendah, Sedang, Tinggi
            $table->string('target_crop', 100)->nullable()->default('padi'); // padi, jagung, kedelai, hortikultura
            $table->decimal('etl_reference', 10, 2)->nullable(); // Economic Threshold Level
            $table->string('etl_unit', 30)->nullable();
            $table->string('photo_url', 300)->nullable();
            $table->text('description')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('references')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opts');
    }
};
