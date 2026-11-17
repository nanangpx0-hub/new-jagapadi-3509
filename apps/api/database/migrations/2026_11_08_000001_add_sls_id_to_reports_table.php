<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('reports', 'sls_id')) {
            Schema::table('reports', function (Blueprint $table): void {
                $table->foreignId('sls_id')->nullable()->after('village_id')->constrained('sls')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('reports', 'sls_id')) {
            Schema::table('reports', function (Blueprint $table): void {
                $table->dropForeign(['sls_id']);
                $table->dropColumn('sls_id');
            });
        }
    }
};
