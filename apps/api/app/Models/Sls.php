<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sls extends Model
{
    protected $table = 'sls';

    protected $fillable = [
        'district_id',
        'village_id',
        'idsls',
        'code',
        'name',
        'latitude',
        'longitude',
        'kk',
        'muatan',
        'luas',
    ];

    protected function casts(): array
    {
        return [
            'kk' => 'integer',
            'muatan' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'luas' => 'float',
        ];
    }

    public function village(): BelongsTo
    {
        return $this->belongsTo(Village::class);
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
