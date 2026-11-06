<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Opt extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'scientific_name',
        'local_name',
        'category',
        'danger_level',
        'target_crop',
        'etl_reference',
        'etl_unit',
        'photo_url',
        'description',
        'attack_signs',
        'management',
        'recommendations',
        'references',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'etl_reference' => 'float',
            'is_active' => 'boolean',
        ];
    }
}
