<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourseGeofence extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'shape',
        'center_lat',
        'center_lng',
        'radius_m',
        'polygon_json',
        'label',
    ];

    protected $casts = [
        'center_lat' => 'float',
        'center_lng' => 'float',
        'radius_m' => 'integer',
        'polygon_json' => 'array',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
