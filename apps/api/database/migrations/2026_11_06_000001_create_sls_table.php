<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->foreignId('village_id')->constrained('villages')->cascadeOnDelete();
            $table->string('idsls', 20)->unique();
            $table->string('code', 10);
            $table->string('name', 150);
            $table->unsignedInteger('kk')->nullable();
            $table->unsignedInteger('muatan')->nullable();
            $table->decimal('luas', 12, 6)->nullable();
            $table->timestamps();

            $table->index('village_id');
            $table->index('district_id');
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sls');
    }
};
