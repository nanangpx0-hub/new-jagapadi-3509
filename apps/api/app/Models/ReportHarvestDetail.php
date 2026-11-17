<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportHarvestDetail extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'commodity',
        'variety',
        'harvest_area_ha',
        'harvest_volume',
        'volume_unit',
        'productivity_ton_ha',
        'farmer_price_per_kg',
    ];

    protected function casts(): array
    {
        return [
            'harvest_area_ha' => 'float',
            'harvest_volume' => 'float',
            'productivity_ton_ha' => 'float',
            'farmer_price_per_kg' => 'float',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }
}
