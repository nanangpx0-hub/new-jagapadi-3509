<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ksa_monthly', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->smallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('commodity', 50)->default('padi');
            $table->decimal('harvest_area_ha', 10, 2)->default(0);
            $table->decimal('puso_area_ha', 10, 2)->default(0);
            $table->decimal('bera_area_ha', 10, 2)->default(0);
            $table->decimal('planted_area_ha', 10, 2)->default(0);
            $table->decimal('estimated_production_ton', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['district_id', 'year', 'month', 'commodity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ksa_monthly');
    }
};
