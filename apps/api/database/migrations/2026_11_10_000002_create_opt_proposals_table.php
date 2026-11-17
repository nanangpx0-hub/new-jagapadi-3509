<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opt_proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('scientific_name', 200)->nullable();
            $table->string('local_name', 150)->nullable();
            $table->string('category', 50)->default('hama');
            $table->string('target_crop', 100)->default('padi');
            $table->text('attack_signs')->nullable();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('Menunggu');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->foreignId('created_opt_id')->nullable()->constrained('opts')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opt_proposals');
    }
};
