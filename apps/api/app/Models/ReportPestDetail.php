<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportPestDetail extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'opt_id',
        'crop_type',
        'crop_age_days',
        'crop_phase',
        'intensity_level',
        'affected_area_ha',
        'threatened_area_ha',
        'control_recommendation',
    ];

    protected function casts(): array
    {
        return [
            'crop_age_days' => 'integer',
            'affected_area_ha' => 'float',
            'threatened_area_ha' => 'float',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    public function opt(): BelongsTo
    {
        return $this->belongsTo(Opt::class, 'opt_id');
    }
}
