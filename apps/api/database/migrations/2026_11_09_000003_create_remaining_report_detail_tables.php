<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // §5.4 Laporan Pupuk
        Schema::create('report_fertilizer_details', function (Blueprint $table): void {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->string('fertilizer_type', 100);
            $table->decimal('dosage_amount', 10, 2)->default(0);
            $table->string('dosage_unit', 50);
            $table->string('application_method', 100)->nullable();
            $table->string('availability_status', 50)->default('Tersedia');
            $table->foreignId('related_opt_id')->nullable()->constrained('opts')->nullOnDelete();
        });

        // §5.5 Laporan Panen
        Schema::create('report_harvest_details', function (Blueprint $table): void {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->string('commodity', 150);
            $table->string('variety', 100)->nullable();
            $table->decimal('harvest_area_ha', 10, 2)->default(0);
            $table->decimal('harvest_volume', 10, 2)->default(0);
            $table->string('volume_unit', 20);
            $table->decimal('productivity_ton_ha', 8, 2)->nullable();
            $table->decimal('farmer_price_per_kg', 15, 2)->nullable();
        });

        // §5.6 Laporan Cuaca Lapangan
        Schema::create('report_weather_details', function (Blueprint $table): void {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->string('weather_condition', 100);
            $table->decimal('temperature_c', 5, 1)->nullable();
            $table->decimal('humidity_pct', 5, 1)->nullable();
            $table->decimal('rainfall_mm', 8, 2)->nullable();
            $table->decimal('wind_speed_kmh', 5, 1)->nullable();
            $table->string('wind_direction', 50)->nullable();
            $table->decimal('impacted_area_ha', 10, 2)->nullable();
        });

        // §5.7 Laporan Alat & Sarana (Alsintan)
        Schema::create('report_equipment_details', function (Blueprint $table): void {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->string('equipment_category', 100);
            $table->string('equipment_name', 200);
            $table->integer('unit_count')->default(1);
            $table->string('condition_status', 50);
            $table->string('ownership_group', 150)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_equipment_details');
        Schema::dropIfExists('report_weather_details');
        Schema::dropIfExists('report_harvest_details');
        Schema::dropIfExists('report_fertilizer_details');
    }
};
