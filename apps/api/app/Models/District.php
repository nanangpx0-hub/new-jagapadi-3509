<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class District extends Model
{
    use HasFactory;

    protected $hidden = ['geom', 'centroid'];

    protected $fillable = [
        'code',
        'regency_bps_code',
        'name',
        'latitude',
        'longitude',
        'source',
        'source_feature_id',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function villages(): HasMany
    {
        return $this->hasMany(Village::class);
    }
}
