<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportPestFollowup extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'user_id',
        'action_date',
        'control_method',
        'controlled_area_ha',
        'chemicals_or_agents_used',
        'outcome_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'action_date' => 'date:Y-m-d',
            'controlled_area_ha' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
