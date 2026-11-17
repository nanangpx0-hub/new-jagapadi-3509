<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportFertilizerDetail extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'fertilizer_type',
        'dosage_amount',
        'dosage_unit',
        'application_method',
        'availability_status',
        'related_opt_id',
    ];

    protected function casts(): array
    {
        return [
            'dosage_amount' => 'float',
            'related_opt_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /** @return BelongsTo<Opt, $this> */
    public function opt(): BelongsTo
    {
        return $this->belongsTo(Opt::class, 'related_opt_id');
    }
}
