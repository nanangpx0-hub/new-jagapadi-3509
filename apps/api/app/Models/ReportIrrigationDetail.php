<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportIrrigationDetail extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'irrigation_area_name',
        'channel_type',
        'physical_condition',
        'water_discharge_status',
        'service_area_ha',
        'repair_status',
        'action_taken',
    ];

    protected function casts(): array
    {
        return [
            'service_area_ha' => 'float',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }
}
