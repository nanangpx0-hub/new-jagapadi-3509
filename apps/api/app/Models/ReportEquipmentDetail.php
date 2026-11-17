<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportEquipmentDetail extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'report_id';

    public $incrementing = false;

    protected $fillable = [
        'report_id',
        'equipment_category',
        'equipment_name',
        'unit_count',
        'condition_status',
        'ownership_group',
    ];

    protected function casts(): array
    {
        return [
            'unit_count' => 'integer',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }
}
