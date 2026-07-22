<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'user_id',
        'device_id',
        'status',
        'checked_in_at',
        'checked_out_at',
        'check_in_lat',
        'check_in_lng',
        'check_in_accuracy_m',
        'distance_from_center_m',
        'within_geofence',
        'face_verified',
        'face_confidence',
        'face_image_path',
        'present_throughout',
        'missed_checks',
        're_entry_count',
        'minutes_present',
        'last_entry_at',
    ];

    protected $casts = [
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
        'check_in_lat' => 'float',
        'check_in_lng' => 'float',
        'check_in_accuracy_m' => 'float',
        'distance_from_center_m' => 'float',
        'within_geofence' => 'boolean',
        'face_verified' => 'boolean',
        'face_confidence' => 'float',
        'present_throughout' => 'boolean',
        'missed_checks' => 'integer',
        're_entry_count' => 'integer',
        'minutes_present' => 'integer',
        'last_entry_at' => 'datetime',
    ];

    /**
     * Minutes actually spent inside the class: completed stints plus the one in
     * progress. `$until` caps an open stint at the session's end time so a
     * student who never clocked out isn't credited past the end of the class.
     */
    public function minutesPresent(?\DateTimeInterface $until = null): int
    {
        $total = (int) $this->minutes_present;

        // Records made before per-stint logging existed have no banked minutes,
        // so fall back to the plain check-in → check-out span.
        if ($total === 0 && !$this->last_entry_at && $this->checked_in_at && $this->checked_out_at) {
            return max(0, (int) round($this->checked_in_at->diffInMinutes($this->checked_out_at)));
        }

        if (!$this->checked_out_at && $this->last_entry_at) {
            $end = $until ? \Illuminate\Support\Carbon::instance($until) : now();
            if ($end->greaterThan(now())) {
                $end = now();
            }
            if ($end->greaterThan($this->last_entry_at)) {
                $total += (int) round($this->last_entry_at->diffInMinutes($end));
            }
        }

        return $total;
    }

    public function events(): HasMany
    {
        return $this->hasMany(AttendanceEvent::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(AttendanceSession::class, 'session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }
}
