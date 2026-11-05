<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tabel Induk Reports
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->string('report_number', 30)->nullable()->unique();
            $table->string('report_type', 20); // pest, irrigation, fertilizer, harvest, weather, equipment
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('Draf'); // Draf, Submitted, Diverifikasi, Ditolak, Diarsipkan
            $table->date('report_date');
            $table->string('regency_bps_code', 10)->default('3509');
            $table->foreignId('district_id')->constrained('districts');
            $table->foreignId('village_id')->nullable()->constrained('villages');
            $table->string('location_name', 255)->nullable();
            $table->string('address_detail', 300)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('is_coordinate_mismatch')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestampTz('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            $table->string('submitted_ip', 45)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'report_type']);
            $table->index(['district_id', 'village_id']);
            $table->index('user_id');
        });

        // Add PostGIS Point column & GiST index
        DB::statement('ALTER TABLE reports ADD COLUMN geom geometry(Point, 4326)');
        DB::statement('CREATE INDEX IF NOT EXISTS reports_geom_gist ON reports USING gist (geom)');

        // 2. Detail Laporan Hama (Pest)
        Schema::create('report_pest_details', function (Blueprint $table) {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->foreignId('opt_id')->constrained('opts');
            $table->string('crop_type', 100)->default('padi');
            $table->integer('crop_age_days')->nullable();
            $table->string('crop_phase', 50)->nullable(); // vegetatif, generatif, panen
            $table->string('intensity_level', 50); // Ringan, Sedang, Berat, Puso
            $table->decimal('affected_area_ha', 10, 2);
            $table->decimal('threatened_area_ha', 10, 2)->nullable();
            $table->text('control_recommendation')->nullable();
        });

        // 3. Detail Laporan Irigasi (Irrigation)
        Schema::create('report_irrigation_details', function (Blueprint $table) {
            $table->foreignId('report_id')->primary()->constrained('reports')->cascadeOnDelete();
            $table->string('irrigation_area_name', 200)->nullable();
            $table->string('channel_type', 20); // Primer, Sekunder, Tersier
            $table->string('physical_condition', 20); // Bagus, Sedang, Tidak Bagus, Rusak
            $table->string('water_discharge_status', 20); // Cukup, Kurang, Kering
            $table->decimal('service_area_ha', 12, 2)->nullable();
            $table->string('repair_status', 30)->default('Normal'); // Normal, Belum Ditangani, Dalam Perbaikan, Selesai Diperbaiki
            $table->text('action_taken')->nullable();
        });

        // 4. Foto Lampiran Laporan
        Schema::create('report_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('file_path', 300);
            $table->string('caption', 255)->nullable();
            $table->integer('file_size_bytes')->nullable();
            $table->string('mime_type', 50)->default('image/webp');
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->timestamps();
        });

        // 5. Riwayat Perubahan Status (Audit Trail)
        Schema::create('report_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->foreignId('actor_id')->constrained('users');
            $table->text('notes')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        // 6. Counter Penomoran Laporan Atomic
        Schema::create('report_number_counters', function (Blueprint $table) {
            $table->id();
            $table->string('report_type', 20);
            $table->char('date_ymd', 8); // YYYYMMDD
            $table->integer('last_number')->default(0);
            $table->timestamps();

            $table->unique(['report_type', 'date_ymd']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_number_counters');
        Schema::dropIfExists('report_status_histories');
        Schema::dropIfExists('report_photos');
        Schema::dropIfExists('report_irrigation_details');
        Schema::dropIfExists('report_pest_details');
        Schema::dropIfExists('reports');
    }
};
