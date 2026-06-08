<?php

namespace Tests\Unit;

use App\Models\CourseGeofence;
use App\Services\GeofenceService;
use Tests\TestCase;

/**
 * Unit tests for the spatial-boundary engine.
 *
 * These cover the literal "does this GPS reading fall inside the class venue"
 * decision for both circular fences (center + radius) and manually-drawn
 * polygon fences. No database is touched — the service is pure math.
 */
class GeofenceServiceTest extends TestCase
{
    private GeofenceService $service;

    /**
     * Meters-per-degree of latitude for the mean earth radius the service uses
     * (R * pi / 180). A pure north/south offset of N metres equals
     * N / METERS_PER_DEG_LAT degrees, and haversine returns it back exactly.
     */
    private const METERS_PER_DEG_LAT = 111194.92664455873;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new GeofenceService();
    }

    /** Offsets a latitude by a known number of metres (north positive). */
    private function latPlusMeters(float $lat, float $meters): float
    {
        return $lat + ($meters / self::METERS_PER_DEG_LAT);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Circle fences
    // ─────────────────────────────────────────────────────────────────────

    public function test_circle_point_at_center_is_inside_with_zero_distance(): void
    {
        $res = $this->service->containsCircle(7.2280, 3.4360, 50, 7.2280, 3.4360);

        $this->assertTrue($res['inside']);
        $this->assertEqualsWithDelta(0.0, $res['distance_m'], 0.01);
    }

    public function test_circle_point_inside_radius_is_inside(): void
    {
        // 30 m due north of a 50 m fence → inside.
        $point = $this->latPlusMeters(7.2280, 30);
        $res = $this->service->containsCircle(7.2280, 3.4360, 50, $point, 3.4360);

        $this->assertTrue($res['inside']);
        $this->assertEqualsWithDelta(30.0, $res['distance_m'], 0.5);
    }

    public function test_circle_point_outside_radius_is_outside(): void
    {
        // 80 m due north of a 50 m fence → outside.
        $point = $this->latPlusMeters(7.2280, 80);
        $res = $this->service->containsCircle(7.2280, 3.4360, 50, $point, 3.4360);

        $this->assertFalse($res['inside']);
        $this->assertEqualsWithDelta(80.0, $res['distance_m'], 0.5);
    }

    public function test_circle_boundary_is_inclusive(): void
    {
        // distance <= radius must count as inside. 49.9 m in, 50.1 m out.
        $justIn = $this->service->containsCircle(7.2280, 3.4360, 50, $this->latPlusMeters(7.2280, 49.9), 3.4360);
        $justOut = $this->service->containsCircle(7.2280, 3.4360, 50, $this->latPlusMeters(7.2280, 50.1), 3.4360);

        $this->assertTrue($justIn['inside'], '49.9 m from a 50 m fence should be inside');
        $this->assertFalse($justOut['inside'], '50.1 m from a 50 m fence should be outside');
    }

    public function test_haversine_distance_matches_known_value(): void
    {
        // 1 degree of latitude ≈ 111.195 km for this earth radius.
        $res = $this->service->containsCircle(0.0, 0.0, 1, 1.0, 0.0);

        $this->assertEqualsWithDelta(111194.93, $res['distance_m'], 1.0);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Polygon fences (manually drawn class boundary)
    // ─────────────────────────────────────────────────────────────────────

    /** A ~111 m square lecture-hall footprint. */
    private function squareVenue(): array
    {
        return [
            ['latitude' => 7.2280, 'longitude' => 3.4360],
            ['latitude' => 7.2280, 'longitude' => 3.4370],
            ['latitude' => 7.2290, 'longitude' => 3.4370],
            ['latitude' => 7.2290, 'longitude' => 3.4360],
        ];
    }

    public function test_polygon_point_in_center_is_inside(): void
    {
        $this->assertTrue(
            $this->service->containsPolygon($this->squareVenue(), 7.2285, 3.4365)
        );
    }

    public function test_polygon_point_east_of_venue_is_outside(): void
    {
        $this->assertFalse(
            $this->service->containsPolygon($this->squareVenue(), 7.2285, 3.4380)
        );
    }

    public function test_polygon_point_south_of_venue_is_outside(): void
    {
        $this->assertFalse(
            $this->service->containsPolygon($this->squareVenue(), 7.2270, 3.4365)
        );
    }

    public function test_polygon_with_fewer_than_three_points_is_never_inside(): void
    {
        $twoPoints = [
            ['latitude' => 7.2280, 'longitude' => 3.4360],
            ['latitude' => 7.2290, 'longitude' => 3.4370],
        ];

        $this->assertFalse($this->service->containsPolygon($twoPoints, 7.2285, 3.4365));
    }

    public function test_polygon_handles_concave_shape(): void
    {
        // An L-shaped venue. The notch corner must read as OUTSIDE.
        $lShape = [
            ['latitude' => 0.0000, 'longitude' => 0.0000],
            ['latitude' => 0.0000, 'longitude' => 0.0040],
            ['latitude' => 0.0020, 'longitude' => 0.0040],
            ['latitude' => 0.0020, 'longitude' => 0.0020],
            ['latitude' => 0.0040, 'longitude' => 0.0020],
            ['latitude' => 0.0040, 'longitude' => 0.0000],
        ];

        // Inside the bottom bar of the L.
        $this->assertTrue($this->service->containsPolygon($lShape, 0.0010, 0.0010));
        // Inside the tall left arm of the L.
        $this->assertTrue($this->service->containsPolygon($lShape, 0.0030, 0.0010));
        // In the cut-out notch (top-right) → outside.
        $this->assertFalse($this->service->containsPolygon($lShape, 0.0030, 0.0030));
    }

    // ─────────────────────────────────────────────────────────────────────
    // evaluate() — dispatches to the right shape from a stored fence
    // ─────────────────────────────────────────────────────────────────────

    public function test_evaluate_circle_fence_inside(): void
    {
        $fence = new CourseGeofence();
        $fence->shape = 'circle';
        $fence->center_lat = 7.2280;
        $fence->center_lng = 3.4360;
        $fence->radius_m = 50;

        $res = $this->service->evaluate($fence, $this->latPlusMeters(7.2280, 20), 3.4360);

        $this->assertTrue($res['inside']);
        $this->assertEqualsWithDelta(20.0, $res['distance_m'], 0.5);
    }

    public function test_evaluate_circle_fence_outside(): void
    {
        $fence = new CourseGeofence();
        $fence->shape = 'circle';
        $fence->center_lat = 7.2280;
        $fence->center_lng = 3.4360;
        $fence->radius_m = 50;

        $res = $this->service->evaluate($fence, $this->latPlusMeters(7.2280, 120), 3.4360);

        $this->assertFalse($res['inside']);
    }

    public function test_evaluate_polygon_fence(): void
    {
        $fence = new CourseGeofence();
        $fence->shape = 'polygon';
        $fence->polygon_json = $this->squareVenue();

        $inside = $this->service->evaluate($fence, 7.2285, 3.4365);
        $outside = $this->service->evaluate($fence, 7.2285, 3.4400);

        $this->assertTrue($inside['inside']);
        $this->assertFalse($outside['inside']);
        $this->assertNotNull($inside['distance_m']);
    }

    public function test_evaluate_malformed_circle_fence_is_outside(): void
    {
        // shape says circle but the center was never set.
        $fence = new CourseGeofence();
        $fence->shape = 'circle';

        $res = $this->service->evaluate($fence, 7.2285, 3.4365);

        $this->assertFalse($res['inside']);
        $this->assertNull($res['distance_m']);
    }

    public function test_evaluate_polygon_fence_with_too_few_points_is_outside(): void
    {
        $fence = new CourseGeofence();
        $fence->shape = 'polygon';
        $fence->polygon_json = [
            ['latitude' => 7.2280, 'longitude' => 3.4360],
            ['latitude' => 7.2290, 'longitude' => 3.4370],
        ];

        $res = $this->service->evaluate($fence, 7.2285, 3.4365);

        $this->assertFalse($res['inside']);
    }
}
