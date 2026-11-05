<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Report extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'client_uuid',
        'report_number',
        'report_type',
        'user_id',
        'status',
        'report_date',
        'regency_bps_code',
        'district_id',
        'village_id',
        'location_name',
        'address_detail',
        'latitude',
        'longitude',
        'is_coordinate_mismatch',
        'notes',
        'verified_by',
        'verified_at',
        'verification_notes',
        'submitted_ip',
    ];

    protected function casts(): array
    {
        return [
            'report_date' => 'date:Y-m-d',
            'latitude' => 'float',
            'longitude' => 'float',
            'is_coordinate_mismatch' => 'boolean',
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function verifiedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    public function village(): BelongsTo
    {
        return $this->belongsTo(Village::class);
    }

    public function pestDetail(): HasOne
    {
        return $this->hasOne(ReportPestDetail::class, 'report_id');
    }

    public function irrigationDetail(): HasOne
    {
        return $this->hasOne(ReportIrrigationDetail::class, 'report_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ReportPhoto::class, 'report_id');
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ReportStatusHistory::class, 'report_id')->orderBy('created_at');
    }
}
