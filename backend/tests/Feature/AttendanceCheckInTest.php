<?php

namespace Tests\Feature;

use App\Models\AttendanceSession;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\CourseGeofence;
use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * End-to-end coverage of the geo-fenced check-in pipeline:
 * time window → enrollment → bound device → geofence → status.
 */
class AttendanceCheckInTest extends TestCase
{
    use RefreshDatabase;

    private const VENUE_LAT = 7.2280;
    private const VENUE_LNG = 3.4360;
    private const DEVICE_UID = 'test-device-uid-001';

    private User $student;
    private User $lecturer;
    private Course $course;
    private AttendanceSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lecturer = User::factory()->create(['role' => 'lecturer']);
        $this->student = User::factory()->create(['role' => 'student', 'matric_no' => 'CS2024001']);

        $this->course = Course::create([
            'code' => 'CS101',
            'title' => 'Intro to CS',
            'department' => 'Computer Science',
            'lecturer_id' => $this->lecturer->id,
            'created_by' => $this->lecturer->id,
        ]);

        CourseGeofence::create([
            'course_id' => $this->course->id,
            'shape' => 'circle',
            'center_lat' => self::VENUE_LAT,
            'center_lng' => self::VENUE_LNG,
            'radius_m' => 50,
            'label' => 'Lecture Hall A',
        ]);

        CourseEnrollment::create([
            'course_id' => $this->course->id,
            'user_id' => $this->student->id,
            'enrolled_at' => now(),
        ]);

        Device::create([
            'user_id' => $this->student->id,
            'device_uid' => self::DEVICE_UID,
            'platform' => 'android',
            'bound_at' => now(),
        ]);

        $this->session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subMinutes(2),
            'ends_at' => now()->addHour(),
            'late_after_minutes' => 10,
            'status' => 'active',
        ]);
    }

    /** Authenticated student request carrying the bound-device header. */
    private function asStudent(): self
    {
        Sanctum::actingAs($this->student);
        return $this;
    }

    private function checkIn(array $body, ?string $deviceUid = self::DEVICE_UID)
    {
        $headers = $deviceUid !== null ? ['X-Device-UID' => $deviceUid] : [];
        return $this->withHeaders($headers)
            ->postJson("/api/sessions/{$this->session->id}/checkin", $body);
    }

    /** A coordinate ~N metres due north of the venue centre. */
    private function pointNorth(float $meters): array
    {
        return [
            'latitude' => self::VENUE_LAT + ($meters / 111194.92664455873),
            'longitude' => self::VENUE_LNG,
        ];
    }

    // ── Happy path ────────────────────────────────────────────────────────

    public function test_student_inside_geofence_checks_in_as_present(): void
    {
        $res = $this->asStudent()->checkIn($this->pointNorth(20));

        $res->assertStatus(201);
        $res->assertJsonPath('data.record.status', 'present');
        $res->assertJsonPath('data.record.within_geofence', true);

        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->session->id,
            'user_id' => $this->student->id,
            'status' => 'present',
            'within_geofence' => true,
        ]);
    }

    public function test_check_in_works_with_polygon_geofence(): void
    {
        // Replace the circle with a square polygon enclosing the venue.
        $this->course->geofence()->delete();
        CourseGeofence::create([
            'course_id' => $this->course->id,
            'shape' => 'polygon',
            'label' => 'Hall A footprint',
            'polygon_json' => [
                ['latitude' => 7.2275, 'longitude' => 3.4355],
                ['latitude' => 7.2275, 'longitude' => 3.4365],
                ['latitude' => 7.2285, 'longitude' => 3.4365],
                ['latitude' => 7.2285, 'longitude' => 3.4355],
            ],
        ]);

        $res = $this->asStudent()->checkIn([
            'latitude' => 7.2280,
            'longitude' => 3.4360,
        ]);

        $res->assertStatus(201);
        $res->assertJsonPath('data.record.within_geofence', true);
    }

    public function test_late_arrival_is_marked_late(): void
    {
        // Session started 30 min ago, late threshold is 10 min.
        $this->session->update(['starts_at' => now()->subMinutes(30)]);

        $res = $this->asStudent()->checkIn($this->pointNorth(10));

        $res->assertStatus(201);
        $res->assertJsonPath('data.record.status', 'late');
    }

    public function test_repeated_check_in_updates_the_same_record(): void
    {
        $this->asStudent()->checkIn($this->pointNorth(10))->assertStatus(201);
        $this->asStudent()->checkIn($this->pointNorth(15))->assertStatus(201);

        $this->assertSame(
            1,
            \App\Models\AttendanceRecord::where('session_id', $this->session->id)
                ->where('user_id', $this->student->id)
                ->count(),
            'A second check-in must update, not duplicate, the record.'
        );
    }

    // ── Geofence enforcement ───────────────────────────────────────────────

    public function test_student_outside_geofence_is_rejected(): void
    {
        $res = $this->asStudent()->checkIn($this->pointNorth(200));

        $res->assertStatus(422);
        $res->assertJson(['message' => 'You are not within the class venue.']);
        $res->assertJsonStructure(['data' => ['distance_m']]);

        $this->assertDatabaseMissing('attendance_records', [
            'session_id' => $this->session->id,
            'user_id' => $this->student->id,
        ]);
    }

    public function test_check_in_rejected_when_course_has_no_geofence(): void
    {
        $this->course->geofence()->delete();

        $res = $this->asStudent()->checkIn($this->pointNorth(5));

        $res->assertStatus(422);
        $res->assertJson(['message' => 'This course has no configured venue. Contact your lecturer.']);
    }

    // ── Time window ─────────────────────────────────────────────────────────

    public function test_check_in_rejected_when_session_closed(): void
    {
        $this->session->update(['status' => 'closed']);

        $this->asStudent()->checkIn($this->pointNorth(5))->assertStatus(422);
    }

    public function test_check_in_rejected_before_session_starts(): void
    {
        $this->session->update([
            'starts_at' => now()->addMinutes(30),
            'ends_at' => now()->addHours(2),
        ]);

        $this->asStudent()->checkIn($this->pointNorth(5))->assertStatus(422);
    }

    public function test_check_in_rejected_after_session_ends(): void
    {
        $this->session->update([
            'starts_at' => now()->subHours(2),
            'ends_at' => now()->subMinutes(5),
        ]);

        $this->asStudent()->checkIn($this->pointNorth(5))->assertStatus(422);
    }

    // ── Enrollment & device binding ──────────────────────────────────────────

    public function test_check_in_rejected_when_not_enrolled(): void
    {
        CourseEnrollment::where('course_id', $this->course->id)
            ->where('user_id', $this->student->id)
            ->delete();

        $res = $this->asStudent()->checkIn($this->pointNorth(5));

        $res->assertStatus(403);
        $res->assertJson(['message' => 'You are not enrolled in this course.']);
    }

    public function test_check_in_rejected_without_device_header(): void
    {
        // No X-Device-UID → EnsureBoundDevice middleware blocks the request.
        $res = $this->asStudent()->checkIn($this->pointNorth(5), null);

        $res->assertStatus(403);
    }

    public function test_check_in_rejected_with_revoked_device(): void
    {
        Device::where('user_id', $this->student->id)
            ->update(['revoked_at' => now()]);

        $res = $this->asStudent()->checkIn($this->pointNorth(5));

        $res->assertStatus(403);
    }

    public function test_check_in_requires_authentication(): void
    {
        $res = $this->withHeaders(['X-Device-UID' => self::DEVICE_UID])
            ->postJson("/api/sessions/{$this->session->id}/checkin", $this->pointNorth(5));

        $res->assertStatus(401);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    public function test_check_in_validates_coordinates(): void
    {
        $res = $this->asStudent()->checkIn(['latitude' => 200, 'longitude' => 500]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['latitude', 'longitude']);
    }
}
