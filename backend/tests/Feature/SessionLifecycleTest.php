<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
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
 * Attendance-session lifecycle: who can open/close, the geofence precondition,
 * and the single-active-session rule.
 */
class SessionLifecycleTest extends TestCase
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

    private function withGeofence(): void
    {
        CourseGeofence::create([
            'course_id' => $this->course->id,
            'shape' => 'circle',
            'center_lat' => 7.2280,
            'center_lng' => 3.4360,
            'radius_m' => 50,
            'label' => 'Hall A',
        ]);
    }

    private function openSession(array $body = [])
    {
        return $this->postJson("/api/courses/{$this->course->id}/sessions", array_merge([
            'mode' => 'tap',
            'duration_minutes' => 60,
        ], $body));
    }

    public function test_owning_lecturer_can_start_session(): void
    {
        $this->withGeofence();
        Sanctum::actingAs($this->lecturer);

        $res = $this->openSession();

        $res->assertStatus(201);
        $res->assertJsonPath('data.session.status', 'active');
        $this->assertDatabaseHas('attendance_sessions', [
            'course_id' => $this->course->id,
            'status' => 'active',
        ]);
    }

    public function test_cannot_start_session_without_geofence(): void
    {
        Sanctum::actingAs($this->lecturer);

        $res = $this->openSession();

        $res->assertStatus(422);
        $res->assertJson(['message' => 'Configure a geofence for this course before starting a session.']);
    }

    public function test_student_cannot_start_session(): void
    {
        $this->withGeofence();
        $student = User::factory()->create(['role' => 'student']);
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
            ->postJson("/api/courses/{$this->course->id}/sessions", ['mode' => 'tap']);

        $res->assertStatus(403);
    }

    public function test_cannot_open_two_active_sessions(): void
    {
        $this->withGeofence();
        Sanctum::actingAs($this->lecturer);

        $this->openSession()->assertStatus(201);
        $this->openSession()->assertStatus(422);
    }

    public function test_lecturer_can_close_session(): void
    {
        $this->withGeofence();
        Sanctum::actingAs($this->lecturer);

        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subMinutes(5),
            'ends_at' => now()->addHour(),
            'status' => 'active',
        ]);

        $res = $this->postJson("/api/sessions/{$session->id}/close");

        $res->assertStatus(200);
        $res->assertJsonPath('data.session.status', 'closed');
    }

    public function test_closing_an_already_closed_session_fails(): void
    {
        Sanctum::actingAs($this->lecturer);

        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->subMinutes(5),
            'status' => 'closed',
            'closed_at' => now()->subMinutes(5),
        ]);

        $this->postJson("/api/sessions/{$session->id}/close")->assertStatus(422);
    }

    public function test_active_endpoint_returns_current_session(): void
    {
        $this->withGeofence();
        Sanctum::actingAs($this->lecturer);
        $this->openSession()->assertStatus(201);

        $res = $this->getJson("/api/courses/{$this->course->id}/sessions/active");

        $res->assertStatus(200);
        $res->assertJsonPath('data.session.status', 'active');
    }

    public function test_closing_session_auto_checks_out_students(): void
    {
        Sanctum::actingAs($this->lecturer);

        $endsAt = now()->addHour();
        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subMinutes(5),
            'ends_at' => $endsAt,
            'status' => 'active',
        ]);

        $student = User::factory()->create(['role' => 'student']);
        $device = Device::create([
            'user_id' => $student->id,
            'device_uid' => 'dev-close-1',
            'platform' => 'android',
            'bound_at' => now(),
        ]);
        $record = AttendanceRecord::create([
            'session_id' => $session->id,
            'user_id' => $student->id,
            'device_id' => $device->id,
            'status' => 'present',
            'checked_in_at' => now()->subMinutes(3),
            'checked_out_at' => null,
        ]);

        $this->postJson("/api/sessions/{$session->id}/close")->assertStatus(200);

        $record->refresh();
        $this->assertNotNull($record->checked_out_at, 'Student should be auto-checked-out on close.');
        $this->assertEquals(
            $endsAt->toDateTimeString(),
            $record->checked_out_at->toDateTimeString(),
            'Checkout time should be the session end time.',
        );
    }

    public function test_close_expired_command_auto_checks_out_students(): void
    {
        $endsAt = now()->subMinute();
        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subHour(),
            'ends_at' => $endsAt,
            'status' => 'active',
        ]);

        $student = User::factory()->create(['role' => 'student']);
        $device = Device::create([
            'user_id' => $student->id,
            'device_uid' => 'dev-expire-1',
            'platform' => 'android',
            'bound_at' => now(),
        ]);
        $record = AttendanceRecord::create([
            'session_id' => $session->id,
            'user_id' => $student->id,
            'device_id' => $device->id,
            'status' => 'present',
            'checked_in_at' => now()->subMinutes(40),
            'checked_out_at' => null,
        ]);

        $this->artisan('geotrack:close-expired-sessions')->assertExitCode(0);

        $session->refresh();
        $record->refresh();
        $this->assertEquals('closed', $session->status);
        $this->assertEquals(
            $endsAt->toDateTimeString(),
            $record->checked_out_at?->toDateTimeString(),
        );
    }

    public function test_lecturer_can_export_attendance_csv(): void
    {
        Sanctum::actingAs($this->lecturer);

        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subMinutes(30),
            'ends_at' => now()->addMinutes(30),
            'status' => 'active',
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'name' => 'Ada Lovelace',
            'matric_no' => 'CSC/2020/001',
        ]);
        $device = Device::create([
            'user_id' => $student->id,
            'device_uid' => 'dev-csv-1',
            'platform' => 'android',
            'bound_at' => now(),
        ]);
        AttendanceRecord::create([
            'session_id' => $session->id,
            'user_id' => $student->id,
            'device_id' => $device->id,
            'status' => 'present',
            'checked_in_at' => now()->subMinutes(20),
            'checked_out_at' => now()->subMinutes(1),
            'within_geofence' => true,
            'face_verified' => true,
            'present_throughout' => true,
        ]);

        $res = $this->get("/api/sessions/{$session->id}/records/csv");

        $res->assertStatus(200);
        $res->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $body = $res->streamedContent();
        $this->assertStringContainsString('Matric No', $body);
        $this->assertStringContainsString('Checked Out', $body);
        $this->assertStringContainsString('Ada Lovelace', $body);
        $this->assertStringContainsString('CSC/2020/001', $body);
    }

    public function test_non_owner_cannot_export_attendance_csv(): void
    {
        $other = User::factory()->create(['role' => 'lecturer']);
        Sanctum::actingAs($other);

        $session = AttendanceSession::create([
            'course_id' => $this->course->id,
            'opened_by' => $this->lecturer->id,
            'mode' => 'tap',
            'starts_at' => now()->subMinutes(30),
            'ends_at' => now()->addMinutes(30),
            'status' => 'active',
        ]);

        $this->get("/api/sessions/{$session->id}/records/csv")->assertStatus(403);
    }
}
