<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'opened_by',
        'mode',
        'starts_at',
        'ends_at',
        'presence_checks_enabled',
        'presence_check_interval_minutes',
        'late_after_minutes',
        'status',
        'closed_at',
        'closed_by',
        'notes',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'closed_at' => 'datetime',
        'presence_checks_enabled' => 'boolean',
        'presence_check_interval_minutes' => 'integer',
        'late_after_minutes' => 'integer',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * @return HasMany<AttendanceRecord, $this>
     */
    public function records(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'session_id');
    }

    /**
     * @return HasMany<PresenceCheck, $this>
     */
    public function presenceChecks(): HasMany
    {
        return $this->hasMany(PresenceCheck::class, 'session_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && $this->starts_at?->isPast()
            && $this->ends_at?->isFuture();
    }
}
