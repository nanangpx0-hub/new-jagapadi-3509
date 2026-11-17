<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('villages', function (Blueprint $table): void {
            if (! Schema::hasColumn('villages', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable()->after('name');
            }
            if (! Schema::hasColumn('villages', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            }
        });

        Schema::table('sls', function (Blueprint $table): void {
            if (! Schema::hasColumn('sls', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable()->after('name');
            }
            if (! Schema::hasColumn('sls', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            }
        });
    }

    public function down(): void
    {
        Schema::table('villages', function (Blueprint $table): void {
            if (Schema::hasColumn('villages', 'longitude')) {
                $table->dropColumn('longitude');
            }
            if (Schema::hasColumn('villages', 'latitude')) {
                $table->dropColumn('latitude');
            }
        });

        Schema::table('sls', function (Blueprint $table): void {
            if (Schema::hasColumn('sls', 'longitude')) {
                $table->dropColumn('longitude');
            }
            if (Schema::hasColumn('sls', 'latitude')) {
                $table->dropColumn('latitude');
            }
        });
    }
};
