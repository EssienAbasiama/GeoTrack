<?php

namespace App\Services;

use App\Models\CourseGeofence;

class GeofenceService
{
    /**
     * Earth radius in meters (mean).
     */
    private const EARTH_RADIUS_M = 6371000.0;

    /**
     * Check whether a point lies within a circle, and return distance from center.
     *
     * @return array{inside: bool, distance_m: float}
     */
    public function containsCircle(float $centerLat, float $centerLng, int $radiusM, float $pointLat, float $pointLng): array
    {
        $distance = $this->haversine($centerLat, $centerLng, $pointLat, $pointLng);

        return [
            'inside' => $distance <= $radiusM,
            'distance_m' => $distance,
        ];
    }

    /**
     * Ray-casting algorithm: does the point lie inside the polygon?
     *
     * @param array<int, array{latitude: float, longitude: float}> $polygon
     */
    public function containsPolygon(array $polygon, float $pointLat, float $pointLng): bool
    {
        $count = count($polygon);
        if ($count < 3) {
            return false;
        }

        $inside = false;
        $j = $count - 1;
        for ($i = 0; $i < $count; $i++) {
            $latI = (float) ($polygon[$i]['latitude'] ?? 0);
            $lngI = (float) ($polygon[$i]['longitude'] ?? 0);
            $latJ = (float) ($polygon[$j]['latitude'] ?? 0);
            $lngJ = (float) ($polygon[$j]['longitude'] ?? 0);

            $intersect = (($lngI > $pointLng) !== ($lngJ > $pointLng))
                && ($pointLat < ($latJ - $latI) * ($pointLng - $lngI) / (($lngJ - $lngI) ?: 1e-12) + $latI);

            if ($intersect) {
                $inside = !$inside;
            }
            $j = $i;
        }

        return $inside;
    }

    /**
     * Evaluate a stored geofence against a coordinate.
     *
     * @return array{inside: bool, distance_m: float|null}
     */
    public function evaluate(CourseGeofence $fence, float $lat, float $lng): array
    {
        if ($fence->shape === 'circle' && $fence->center_lat !== null && $fence->center_lng !== null) {
            $radius = $fence->radius_m ?? 50;
            $res = $this->containsCircle((float) $fence->center_lat, (float) $fence->center_lng, (int) $radius, $lat, $lng);

            return [
                'inside' => $res['inside'],
                'distance_m' => $res['distance_m'],
            ];
        }

        if ($fence->shape === 'polygon' && is_array($fence->polygon_json) && count($fence->polygon_json) >= 3) {
            $inside = $this->containsPolygon($fence->polygon_json, $lat, $lng);
            $distance = $this->approximatePolygonDistance($fence->polygon_json, $lat, $lng);

            return [
                'inside' => $inside,
                'distance_m' => $distance,
            ];
        }

        return [
            'inside' => false,
            'distance_m' => null,
        ];
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $deltaPhi = deg2rad($lat2 - $lat1);
        $deltaLambda = deg2rad($lng2 - $lng1);

        $a = sin($deltaPhi / 2) ** 2
            + cos($phi1) * cos($phi2) * sin($deltaLambda / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return self::EARTH_RADIUS_M * $c;
    }

    /**
     * Cheap approximation: distance to the closest polygon vertex.
     *
     * @param array<int, array{latitude: float, longitude: float}> $polygon
     */
    private function approximatePolygonDistance(array $polygon, float $lat, float $lng): float
    {
        $min = INF;
        foreach ($polygon as $vertex) {
            $d = $this->haversine(
                (float) ($vertex['latitude'] ?? 0),
                (float) ($vertex['longitude'] ?? 0),
                $lat,
                $lng
            );
            if ($d < $min) {
                $min = $d;
            }
        }

        return $min === INF ? 0.0 : (float) $min;
    }
}
