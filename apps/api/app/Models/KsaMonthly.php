<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KsaMonthly extends Model
{
    protected $table = 'ksa_monthly';

    protected $fillable = [
        'district_id',
        'year',
        'month',
        'commodity',
        'harvest_area_ha',
        'puso_area_ha',
        'bera_area_ha',
        'planted_area_ha',
        'estimated_production_ton',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'harvest_area_ha' => 'float',
            'puso_area_ha' => 'float',
            'bera_area_ha' => 'float',
            'planted_area_ha' => 'float',
            'estimated_production_ton' => 'float',
        ];
    }

    /** @return BelongsTo<District, $this> */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }
}
