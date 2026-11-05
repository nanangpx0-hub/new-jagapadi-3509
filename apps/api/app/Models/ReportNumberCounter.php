<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportNumberCounter extends Model
{
    protected $fillable = [
        'report_type',
        'date_ymd',
        'last_number',
    ];
}
