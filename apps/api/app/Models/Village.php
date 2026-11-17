<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Village extends Model
{
    use HasFactory;

    protected $hidden = ['geom', 'centroid'];

    protected $fillable = [
        'district_id',
        'code',
        'name',
        'latitude',
        'longitude',
        'fallback_radius_m',
        'source',
        'source_feature_id',
    ];

    protected function casts(): array
    {
        return [
            'fallback_radius_m' => 'float',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }
}
