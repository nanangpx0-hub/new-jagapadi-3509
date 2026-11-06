<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('opts', function (Blueprint $table) {
            $table->text('attack_signs')->nullable()->after('description');
            $table->text('management')->nullable()->after('attack_signs');
        });
    }

    public function down(): void
    {
        Schema::table('opts', function (Blueprint $table) {
            $table->dropColumn(['attack_signs', 'management']);
        });
    }
};
