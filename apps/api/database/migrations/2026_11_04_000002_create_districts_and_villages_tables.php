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
        // Pastikan extension postgis aktif
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('regency_bps_code', 10)->default('3509');
            $table->string('name', 150);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('source', 100)->default('BPS Jember');
            $table->string('source_feature_id', 100)->nullable();
            $table->timestamps();
        });

        // Add PostGIS geometry columns & spatial GiST index
        DB::statement('ALTER TABLE districts ADD COLUMN geom geometry(MultiPolygon, 4326)');
        DB::statement('ALTER TABLE districts ADD COLUMN centroid geometry(Point, 4326)');
        DB::statement('CREATE INDEX IF NOT EXISTS districts_geom_gist ON districts USING gist (geom)');
        DB::statement('CREATE INDEX IF NOT EXISTS districts_centroid_gist ON districts USING gist (centroid)');

        Schema::create('villages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->string('code', 20)->unique();
            $table->string('name', 150);
            $table->double('fallback_radius_m')->nullable()->default(3000);
            $table->string('source', 100)->default('BPS Jember');
            $table->string('source_feature_id', 100)->nullable();
            $table->timestamps();
        });

        DB::statement('ALTER TABLE villages ADD COLUMN geom geometry(MultiPolygon, 4326)');
        DB::statement('ALTER TABLE villages ADD COLUMN centroid geometry(Point, 4326)');
        DB::statement('CREATE INDEX IF NOT EXISTS villages_district_id_idx ON villages (district_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS villages_geom_gist ON villages USING gist (geom)');
        DB::statement('CREATE INDEX IF NOT EXISTS villages_centroid_gist ON villages USING gist (centroid)');
    }

    public function down(): void
    {
        Schema::dropIfExists('villages');
        Schema::dropIfExists('districts');
    }
};
