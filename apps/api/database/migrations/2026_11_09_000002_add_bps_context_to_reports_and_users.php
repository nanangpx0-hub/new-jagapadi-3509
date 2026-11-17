<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            if (! Schema::hasColumn('reports', 'commodity')) {
                $table->string('commodity', 100)->nullable()->after('report_type');
            }
            if (! Schema::hasColumn('reports', 'ksa_segment_code')) {
                $table->string('ksa_segment_code', 20)->nullable()->after('commodity');
            }
            if (! Schema::hasColumn('reports', 'ksa_phase')) {
                $table->string('ksa_phase', 40)->nullable()->after('ksa_segment_code');
            }
            if (! Schema::hasColumn('reports', 'statistical_impacts')) {
                $table->json('statistical_impacts')->nullable()->after('ksa_phase');
            }
            $table->index('commodity', 'reports_commodity_index');
            $table->index('report_date', 'reports_report_date_index');
        });

        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'assigned_district_id')) {
                $table->foreignId('assigned_district_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('districts')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropIndex('reports_commodity_index');
            $table->dropIndex('reports_report_date_index');
            $table->dropColumn([
                'commodity',
                'ksa_segment_code',
                'ksa_phase',
                'statistical_impacts',
            ]);
        });

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'assigned_district_id')) {
                $table->dropColumn('assigned_district_id');
            }
        });
    }
};
