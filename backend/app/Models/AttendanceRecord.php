<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ];

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
