<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_pest_details', function (Blueprint $table): void {
            if (! Schema::hasColumn('report_pest_details', 'population_intensity')) {
                $table->decimal('population_intensity', 8, 2)->nullable()->after('affected_area_ha');
            }
            if (! Schema::hasColumn('report_pest_details', 'etl_unit')) {
                $table->string('etl_unit', 50)->nullable()->after('population_intensity');
            }
            if (! Schema::hasColumn('report_pest_details', 'is_above_etl')) {
                $table->boolean('is_above_etl')->default(false)->after('etl_unit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('report_pest_details', function (Blueprint $table): void {
            $columns = [];
            foreach (['population_intensity', 'etl_unit', 'is_above_etl'] as $column) {
                if (Schema::hasColumn('report_pest_details', $column)) {
                    $columns[] = $column;
                }
            }
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
