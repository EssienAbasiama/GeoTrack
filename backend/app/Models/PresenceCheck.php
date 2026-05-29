<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresenceCheck extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'triggered_at',
        'expires_at',
        'trigger_type',
        'targeted_user_ids',
    ];

    protected $casts = [
        'triggered_at' => 'datetime',
        'expires_at' => 'datetime',
        'targeted_user_ids' => 'array',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(AttendanceSession::class, 'session_id');
    }

    /**
     * @return HasMany<PresenceResponse, $this>
     */
    public function responses(): HasMany
    {
        return $this->hasMany(PresenceResponse::class);
    }

    public function isOpen(): bool
    {
        return $this->expires_at?->isFuture() === true;
    }
}
