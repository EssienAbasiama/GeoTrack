<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Services\ScheduledSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class SessionController extends Controller
{
    public function __construct(private readonly ScheduledSessionService $scheduledSessions)
    {
    }

    public function store(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to start a session for this course.',
            ], 403);
        }

        $validated = $request->validate([
            'mode' => ['required', 'in:tap,face_recognition,manual'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:480'],
            'presence_checks_enabled' => ['nullable', 'boolean'],
            'presence_check_interval_minutes' => ['nullable', 'integer', 'min:1', 'max:120'],
            'late_after_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validated['mode'] !== 'manual' && !$course->geofence) {
            return response()->json([
                'message' => 'Configure a geofence for this course before starting a session.',
            ], 422);
        }

        $hasActive = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->where('ends_at', '>', now())
            ->exists();
        if ($hasActive) {
            return response()->json([
                'message' => 'An active session already exists for this course.',
            ], 422);
        }

        try {
            $session = DB::transaction(function () use ($validated, $course, $user) {
                $startsAt = now();
                $endsAt = Carbon::parse($startsAt)->addMinutes((int) ($validated['duration_minutes'] ?? 60));

                return AttendanceSession::query()->create([
                    'course_id' => $course->id,
                    'opened_by' => $user->id,
                    'mode' => $validated['mode'],
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'presence_checks_enabled' => $validated['presence_checks_enabled'] ?? true,
                    'presence_check_interval_minutes' => $validated['presence_check_interval_minutes'] ?? 15,
                    'late_after_minutes' => $validated['late_after_minutes'] ?? 10,
                    'status' => 'active',
                    'notes' => $validated['notes'] ?? null,
                ]);
            });
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to start session right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Session started.',
            'data' => ['session' => $session],
        ], 201);
    }

    public function index(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        $isEnrolled = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id && !$isEnrolled) {
            return response()->json([
                'message' => 'You do not have access to this course.',
            ], 403);
        }

        $sessions = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->orderByDesc('starts_at')
            ->get();

        return response()->json([
            'message' => 'Sessions retrieved.',
            'data' => ['sessions' => $sessions],
        ]);
    }

    public function active(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        $isEnrolled = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id && !$isEnrolled) {
            return response()->json([
                'message' => 'You do not have access to this course.',
            ], 403);
        }

        $session = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->where('ends_at', '>', now())
            ->latest('id')
            ->first();

        // If nobody has started a session but the class is within its scheduled
        // day/time window, open one automatically so students can check in.
        if (!$session) {
            $session = $this->scheduledSessions->ensureForCourse($course);
        }

        return response()->json([
            'message' => $session ? 'Active session retrieved.' : 'No active session for this course.',
            'data' => ['session' => $session],
        ]);
    }

    public function show(Request $request, AttendanceSession $session): JsonResponse
    {
        $user = $request->user();
        $course = $session->course;
        $isEnrolled = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id && !$isEnrolled) {
            return response()->json([
                'message' => 'You do not have access to this session.',
            ], 403);
        }

        $session->load(['course:id,code,title', 'opener:id,name']);

        return response()->json([
            'message' => 'Session retrieved.',
            'data' => ['session' => $session],
        ]);
    }

    public function close(Request $request, AttendanceSession $session): JsonResponse
    {
        $user = $request->user();
        $course = $session->course;
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to close this session.',
            ], 403);
        }

        if ($session->status === 'closed') {
            return response()->json([
                'message' => 'Session is already closed.',
            ], 422);
        }

        $now = now();
        DB::transaction(function () use ($session, $now, $user) {
            // Auto-check-out any student still checked in when the lecturer ends
            // the session, using the session end time as the checkout instant.
            \App\Models\AttendanceRecord::query()
                ->where('session_id', $session->id)
                ->whereNotNull('checked_in_at')
                ->whereNull('checked_out_at')
                ->update(['checked_out_at' => $session->ends_at ?? $now]);

            $session->update([
                'status' => 'closed',
                'closed_at' => $now,
                'closed_by' => $user->id,
            ]);
        });

        return response()->json([
            'message' => 'Session closed.',
            'data' => ['session' => $session->fresh()],
        ]);
    }

    /**
     * Export the day's attendance for a session as a downloadable CSV file.
     * Lists each student with their check-in and check-out times.
     */
    public function exportCsv(Request $request, AttendanceSession $session)
    {
        $user = $request->user();
        $course = $session->course;
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to export records for this session.',
            ], 403);
        }

        $records = $session->records()
            ->with('user:id,name,matric_no,email')
            ->orderBy('checked_in_at')
            ->get();

        $columns = [
            'S/N', 'Matric No', 'Name', 'Email', 'Status',
            'Checked In', 'Checked Out', 'Within Geofence',
            'Face Verified', 'Present Throughout', 'Distance (m)',
        ];

        $fmt = static fn ($dt): string => $dt ? $dt->format('Y-m-d H:i:s') : '';

        $callback = function () use ($records, $columns, $fmt): void {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel renders accents/symbols correctly.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $columns);
            $i = 1;
            foreach ($records as $r) {
                fputcsv($out, [
                    $i++,
                    $r->user->matric_no ?? '',
                    $r->user->name ?? '',
                    $r->user->email ?? '',
                    ucfirst((string) $r->status),
                    $fmt($r->checked_in_at),
                    $fmt($r->checked_out_at),
                    $r->within_geofence ? 'Yes' : 'No',
                    $r->face_verified ? 'Yes' : 'No',
                    $r->present_throughout ? 'Yes' : 'No',
                    $r->distance_from_center_m !== null ? round((float) $r->distance_from_center_m, 1) : '',
                ]);
            }
            fclose($out);
        };

        $code = $course->code ?? 'class';
        $date = optional($session->starts_at)->format('Y-m-d') ?? now()->format('Y-m-d');
        $filename = preg_replace('/[^A-Za-z0-9_\-.]/', '_', "{$code}_{$date}_attendance.csv");

        return response()->streamDownload($callback, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function records(Request $request, AttendanceSession $session): JsonResponse
    {
        $user = $request->user();
        $course = $session->course;
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to view records for this session.',
            ], 403);
        }

        $records = $session->records()
            ->with('user:id,name,matric_no,email')
            ->orderBy('checked_in_at')
            ->get();

        return response()->json([
            'message' => 'Session records retrieved.',
            'data' => ['records' => $records],
        ]);
    }
}
