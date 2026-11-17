<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property-read int $subround
 * @property-read int $quarter
 * @property array<int, string>|null $statistical_impacts
 * @property-read District|null $district
 * @property-read Village|null $village
 * @property-read Sls|null $sls
 * @property-read ReportPestDetail|null $pestDetail
 * @property-read ReportIrrigationDetail|null $irrigationDetail
 * @property-read ReportFertilizerDetail|null $fertilizerDetail
 * @property-read ReportHarvestDetail|null $harvestDetail
 * @property-read ReportWeatherDetail|null $weatherDetail
 * @property-read ReportEquipmentDetail|null $equipmentDetail
 */
class Report extends Model
{
    use HasFactory, SoftDeletes;

    protected $hidden = ['geom'];

    protected $fillable = [
        'client_uuid',
        'report_number',
        'report_type',
        'commodity',
        'ksa_segment_code',
        'ksa_phase',
        'statistical_impacts',
        'user_id',
        'status',
        'report_date',
        'regency_bps_code',
        'district_id',
        'village_id',
        'sls_id',
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
            'sls_id' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'is_coordinate_mismatch' => 'boolean',
            'verified_at' => 'datetime',
            'statistical_impacts' => 'array',
        ];
    }

    /** Subround dan triwulan BPS ikut terkirim bersama laporan. */
    protected $appends = ['subround', 'quarter'];

    protected function subround(): Attribute
    {
        return Attribute::get(function (): int {
            $month = $this->reportMonth();

            return $month <= 4 ? 1 : ($month <= 8 ? 2 : 3);
        });
    }

    protected function quarter(): Attribute
    {
        return Attribute::get(fn (): int => (int) ceil($this->reportMonth() / 3));
    }

    private function reportMonth(): int
    {
        return $this->report_date
            ? (int) Carbon::parse((string) $this->report_date)->format('n')
            : (int) now()->format('n');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function verifiedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /** @return BelongsTo<District, $this> */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    /** @return BelongsTo<Village, $this> */
    public function village(): BelongsTo
    {
        return $this->belongsTo(Village::class);
    }

    /** @return BelongsTo<Sls, $this> */
    public function sls(): BelongsTo
    {
        return $this->belongsTo(Sls::class);
    }

    public function pestDetail(): HasOne
    {
        return $this->hasOne(ReportPestDetail::class, 'report_id');
    }

    /** @return HasOne<ReportIrrigationDetail, $this> */
    public function irrigationDetail(): HasOne
    {
        return $this->hasOne(ReportIrrigationDetail::class, 'report_id');
    }

    /** @return HasOne<ReportFertilizerDetail, $this> */
    public function fertilizerDetail(): HasOne
    {
        return $this->hasOne(ReportFertilizerDetail::class, 'report_id');
    }

    /** @return HasOne<ReportHarvestDetail, $this> */
    public function harvestDetail(): HasOne
    {
        return $this->hasOne(ReportHarvestDetail::class, 'report_id');
    }

    /** @return HasOne<ReportWeatherDetail, $this> */
    public function weatherDetail(): HasOne
    {
        return $this->hasOne(ReportWeatherDetail::class, 'report_id');
    }

    /** @return HasOne<ReportEquipmentDetail, $this> */
    public function equipmentDetail(): HasOne
    {
        return $this->hasOne(ReportEquipmentDetail::class, 'report_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ReportPhoto::class, 'report_id');
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ReportStatusHistory::class, 'report_id')->orderBy('created_at');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(ReportPestFollowup::class, 'report_id')->orderBy('action_date');
    }
}
