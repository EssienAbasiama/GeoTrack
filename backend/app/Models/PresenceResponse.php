<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PresenceResponse extends Model
{
    use HasFactory;

    protected $fillable = [
        'presence_check_id',
        'user_id',
        'responded_at',
        'response_lat',
        'response_lng',
        'within_geofence',
        'face_verified',
        'face_confidence',
        'face_image_path',
        'status',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'response_lat' => 'float',
        'response_lng' => 'float',
        'within_geofence' => 'boolean',
        'face_verified' => 'boolean',
        'face_confidence' => 'float',
    ];

    public function presenceCheck(): BelongsTo
    {
        return $this->belongsTo(PresenceCheck::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
