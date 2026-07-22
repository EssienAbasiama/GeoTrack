<?php

namespace App\Services;

use App\Models\AttendanceSession;
use App\Models\Course;

/**
 * Opens attendance sessions automatically when a course is inside its scheduled
 * day/time window, so "in session" status is consistent everywhere (home
 * dashboard, check-in, class detail) without a lecturer manually starting one.
 *
 * Schedule times are interpreted in the app timezone (config/app.php).
 */
class ScheduledSessionService
{
    /** Ensure due sessions exist for a set of course ids. */
    public function ensureForCourseIds(iterable $courseIds): void
    {
        $ids = collect($courseIds)->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return;
        }

        Course::query()
            ->whereIn('id', $ids)
            ->with('geofence')
            ->get()
            ->each(fn (Course $course) => $this->ensureForCourse($course));
    }

    /**
     * Open (or reuse) a session for a course when "now" falls inside its
     * scheduled window. Returns null when there's no schedule/geofence or the
     * current time is outside the window.
     */
    public function ensureForCourse(Course $course): ?AttendanceSession
    {
        // Attendance is lecturer-controlled: a session must be explicitly started
        // by the lecturer. Opening one off the timetable would let students mark
        // attendance with no lecturer involvement, so this is disabled unless
        // GEOTRACK_AUTO_OPEN_SESSIONS is turned on.
        if (!config('geotrack.auto_open_scheduled_sessions')) {
            return null;
        }

        if (!$course->day || !$course->start_time || !$course->end_time || !$course->geofence) {
            return null;
        }

        $now = now();
        if (strcasecmp($now->format('l'), trim($course->day)) !== 0) {
            return null;
        }

        [$sh, $sm] = $this->parseHourMinute($course->start_time);
        [$eh, $em] = $this->parseHourMinute($course->end_time);
        if ($sh === null || $eh === null) {
            return null;
        }

        $start = $now->copy()->setTime($sh, $sm, 0);
        $end = $now->copy()->setTime($eh, $em, 0);
        if ($end->lessThanOrEqualTo($start)) {
            return null;
        }

        // Allow check-in up to 15 minutes before the scheduled start.
        if ($now->lessThan($start->copy()->subMinutes(15)) || $now->greaterThan($end)) {
            return null;
        }

        $existing = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->where('starts_at', $start)
            ->first();
        if ($existing) {
            if ($existing->status !== 'active') {
                $existing->update(['status' => 'active', 'closed_at' => null]);
            }
            return $existing;
        }

        return AttendanceSession::query()->create([
            'course_id' => $course->id,
            'opened_by' => $course->lecturer_id ?? $course->created_by,
            'mode' => 'tap',
            'starts_at' => $start,
            'ends_at' => $end,
            'presence_checks_enabled' => false,
            'presence_check_interval_minutes' => 15,
            'late_after_minutes' => 10,
            'status' => 'active',
            'notes' => 'Auto-opened from class schedule.',
        ]);
    }

    /**
     * Parse "HH:MM" (24h) or "h:MM AM/PM" into [hour, minute]; [null, null] on failure.
     *
     * @return array{0: int|null, 1: int|null}
     */
    private function parseHourMinute(?string $time): array
    {
        if (!$time || !preg_match('/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i', trim($time), $m)) {
            return [null, null];
        }
        $hour = (int) $m[1];
        $minute = (int) $m[2];
        $meridiem = isset($m[3]) ? strtoupper($m[3]) : null;
        if ($meridiem === 'PM' && $hour !== 12) {
            $hour += 12;
        }
        if ($meridiem === 'AM' && $hour === 12) {
            $hour = 0;
        }
        return [$hour, $minute];
    }
}
