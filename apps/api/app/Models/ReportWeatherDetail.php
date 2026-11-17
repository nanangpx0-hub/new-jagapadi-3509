<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportWeatherDetail extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'weather_condition',
        'temperature_c',
        'humidity_pct',
        'rainfall_mm',
        'wind_speed_kmh',
        'wind_direction',
        'impacted_area_ha',
    ];

    protected function casts(): array
    {
        return [
            'temperature_c' => 'float',
            'humidity_pct' => 'float',
            'rainfall_mm' => 'float',
            'wind_speed_kmh' => 'float',
            'impacted_area_ha' => 'float',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }
}
