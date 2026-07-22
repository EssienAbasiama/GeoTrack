<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry or exit within a class. See the migration for why this exists
 * separately from AttendanceRecord.
 */
class AttendanceEvent extends Model
{
    public const CHECK_IN = 'check_in';
    public const RE_ENTRY = 're_entry';
    public const CHECK_OUT = 'check_out';

    protected $fillable = [
        'attendance_record_id',
        'session_id',
        'user_id',
        'device_id',
        'type',
        'occurred_at',
        'latitude',
        'longitude',
        'within_geofence',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
        'within_geofence' => 'boolean',
    ];

    /** Human label used in the app and in exported reports. */
    public function label(): string
    {
        return match ($this->type) {
            self::CHECK_IN => 'Clocked in',
            self::RE_ENTRY => 'Clocked in again',
            self::CHECK_OUT => 'Clocked out',
            default => $this->type,
        };
    }

    public function record(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class, 'attendance_record_id');
    }
}
