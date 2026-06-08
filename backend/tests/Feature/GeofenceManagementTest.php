<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers how the manual spatial boundary is *defined* for a class location:
 * who may set it (role authorisation) and what shapes validate.
 */
class GeofenceManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $lecturer;
    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lecturer = User::factory()->create(['role' => 'lecturer']);
        $this->course = Course::create([
            'code' => 'CS101',
            'title' => 'Intro to CS',
            'department' => 'Computer Science',
            'lecturer_id' => $this->lecturer->id,
            'created_by' => $this->lecturer->id,
        ]);
    }

    private function circlePayload(array $overrides = []): array
    {
        return array_merge([
            'shape' => 'circle',
            'label' => 'Lecture Hall A',
            'center_lat' => 7.2280,
            'center_lng' => 3.4360,
            'radius_m' => 50,
        ], $overrides);
    }

    private function putGeofence(array $payload)
    {
        return $this->putJson("/api/courses/{$this->course->id}/geofence", $payload);
    }

    // ── Owning lecturer / admin can define the boundary ──────────────────────

    public function test_owning_lecturer_can_set_circle_geofence(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->putGeofence($this->circlePayload());

        $res->assertStatus(200);
        $res->assertJsonPath('data.geofence.shape', 'circle');
        $this->assertDatabaseHas('course_geofences', [
            'course_id' => $this->course->id,
            'shape' => 'circle',
            'radius_m' => 50,
        ]);
    }

    public function test_owning_lecturer_can_set_polygon_geofence(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->putGeofence([
            'shape' => 'polygon',
            'label' => 'Hall A footprint',
            'polygon' => [
                ['latitude' => 7.2275, 'longitude' => 3.4355],
                ['latitude' => 7.2275, 'longitude' => 3.4365],
                ['latitude' => 7.2285, 'longitude' => 3.4365],
                ['latitude' => 7.2285, 'longitude' => 3.4355],
            ],
        ]);

        $res->assertStatus(200);
        $res->assertJsonPath('data.geofence.shape', 'polygon');
    }

    public function test_admin_can_set_geofence_for_any_course(): void
    {
        $admin = User::factory()->create(['role' => 'hoc']);
        Sanctum::actingAs($admin);

        $this->putGeofence($this->circlePayload())->assertStatus(200);
    }

    public function test_upsert_replaces_existing_geofence_not_duplicates(): void
    {
        Sanctum::actingAs($this->lecturer);

        $this->putGeofence($this->circlePayload(['radius_m' => 50]))->assertStatus(200);
        $this->putGeofence($this->circlePayload(['radius_m' => 120]))->assertStatus(200);

        $this->assertSame(1, $this->course->geofence()->count());
        $this->assertSame(120, $this->course->fresh()->geofence->radius_m);
    }

    // ── Unauthorised roles are blocked ───────────────────────────────────────

    public function test_student_cannot_set_geofence(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        // Give the student a bound device so the request clears middleware and
        // the 403 we assert comes from the controller's authorisation check.
        Device::create([
            'user_id' => $student->id,
            'device_uid' => 'stu-device',
            'platform' => 'android',
            'bound_at' => now(),
        ]);
        CourseEnrollment::create([
            'course_id' => $this->course->id,
            'user_id' => $student->id,
            'enrolled_at' => now(),
        ]);

        Sanctum::actingAs($student);

        $res = $this->withHeaders(['X-Device-UID' => 'stu-device'])
            ->putJson("/api/courses/{$this->course->id}/geofence", $this->circlePayload());

        $res->assertStatus(403);
    }

    public function test_other_lecturer_cannot_set_geofence_for_unowned_course(): void
    {
        $otherLecturer = User::factory()->create(['role' => 'lecturer']);
        Sanctum::actingAs($otherLecturer);

        $this->putGeofence($this->circlePayload())->assertStatus(403);
    }

    // ── Shape validation ─────────────────────────────────────────────────────

    public function test_circle_without_center_is_rejected(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->putGeofence([
            'shape' => 'circle',
            'label' => 'No center',
        ]);

        $res->assertStatus(422);
    }

    public function test_polygon_with_too_few_points_is_rejected(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->putGeofence([
            'shape' => 'polygon',
            'label' => 'Bad polygon',
            'polygon' => [
                ['latitude' => 7.2275, 'longitude' => 3.4355],
                ['latitude' => 7.2285, 'longitude' => 3.4365],
            ],
        ]);

        $res->assertStatus(422);
    }

    public function test_invalid_shape_is_rejected(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->putGeofence([
            'shape' => 'triangle',
            'label' => 'Nope',
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['shape']);
    }

    public function test_show_returns_configured_geofence(): void
    {
        Sanctum::actingAs($this->lecturer);
        $this->putGeofence($this->circlePayload())->assertStatus(200);

        $res = $this->getJson("/api/courses/{$this->course->id}/geofence");

        $res->assertStatus(200);
        $res->assertJsonPath('data.geofence.shape', 'circle');
    }
}
