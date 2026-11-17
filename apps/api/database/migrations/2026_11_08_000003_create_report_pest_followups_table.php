<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_pest_followups', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('action_date');
            $table->string('control_method', 50);
            $table->decimal('controlled_area_ha', 10, 2)->nullable();
            $table->string('chemicals_or_agents_used', 255)->nullable();
            $table->string('outcome_status', 20);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['report_id', 'action_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_pest_followups');
    }
};
