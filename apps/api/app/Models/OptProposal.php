<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OptProposal extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'scientific_name',
        'local_name',
        'category',
        'target_crop',
        'attack_signs',
        'description',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'created_opt_id',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'reviewed_by' => 'integer',
            'created_opt_id' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** @return BelongsTo<Opt, $this> */
    public function createdOpt(): BelongsTo
    {
        return $this->belongsTo(Opt::class, 'created_opt_id');
    }
}
