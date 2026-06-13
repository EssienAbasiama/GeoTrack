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
        'radius_m' => 'integer',
        'polygon_json' => 'array',
    ];

    /**
     * Expose API-friendly aliases the mobile client expects (`polygon`, `name`)
     * alongside a usable center for polygons (whose stored center is null).
     */
    protected $appends = ['polygon', 'name'];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function getPolygonAttribute(): ?array
    {
        return $this->polygon_json;
    }

    public function getNameAttribute(): ?string
    {
        return $this->label;
    }

    public function getCenterLatAttribute(): ?float
    {
        $raw = $this->attributes['center_lat'] ?? null;
        if ($raw !== null) {
            return (float) $raw;
        }
        return $this->polygonCentroid()['lat'] ?? null;
    }

    public function getCenterLngAttribute(): ?float
    {
        $raw = $this->attributes['center_lng'] ?? null;
        if ($raw !== null) {
            return (float) $raw;
        }
        return $this->polygonCentroid()['lng'] ?? null;
    }

    /** Average of the polygon vertices — a sensible map/directions anchor. */
    protected function polygonCentroid(): array
    {
        $points = $this->polygon_json;
        if (!is_array($points) || count($points) === 0) {
            return [];
        }

        $lat = 0.0;
        $lng = 0.0;
        $count = 0;
        foreach ($points as $point) {
            if (isset($point['latitude'], $point['longitude'])) {
                $lat += (float) $point['latitude'];
                $lng += (float) $point['longitude'];
                $count++;
            }
        }

        if ($count === 0) {
            return [];
        }

        return ['lat' => $lat / $count, 'lng' => $lng / $count];
    }
}
