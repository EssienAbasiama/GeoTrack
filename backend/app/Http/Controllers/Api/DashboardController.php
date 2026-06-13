<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\User;
use App\Services\ScheduledSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(private readonly ScheduledSessionService $scheduledSessions)
    {
    }

    public function student(Request $request): JsonResponse
    {
        $user = $request->user();

        $courseIds = CourseEnrollment::query()
            ->where('user_id', $user->id)
            ->pluck('course_id');

        // Open any sessions that are due by schedule so "in session" classes show.
        $this->scheduledSessions->ensureForCourseIds($courseIds);

        $totalCourses = $courseIds->count();
        $allSessionIds = AttendanceSession::query()
            ->whereIn('course_id', $courseIds)
            ->pluck('id');

        $totalSessions = $allSessionIds->count();
        $attendedSessions = AttendanceRecord::query()
            ->where('user_id', $user->id)
            ->whereIn('session_id', $allSessionIds)
            ->whereIn('status', ['present', 'late'])
            ->count();

        $rate = $totalSessions > 0
            ? round($attendedSessions / $totalSessions * 100, 2)
            : 0.0;

        $recent = AttendanceRecord::query()
            ->with(['session:id,course_id,starts_at,mode', 'session.course:id,code,title'])
            ->where('user_id', $user->id)
            ->orderByDesc('checked_in_at')
            ->limit(5)
            ->get();

        $upcoming = Course::query()
            ->whereIn('id', $courseIds)
            ->whereHas('sessions', function ($q) {
                $q->where('status', 'active')->where('ends_at', '>', now());
            })
            ->with(['geofence'])
            ->limit(3)
            ->get();

        return response()->json([
            'message' => 'Student dashboard retrieved.',
            'data' => [
                'totals' => [
                    'courses' => $totalCourses,
                    'sessions' => $totalSessions,
                    'attended' => $attendedSessions,
                    'attendance_rate' => $rate,
                ],
                'recent_attendance' => $recent,
                'upcoming_classes' => $upcoming,
            ],
        ]);
    }

    public function lecturer(Request $request): JsonResponse
    {
        $user = $request->user();

        // Lecturers see courses they teach; an HOC sees the classes they oversee
        // (the ones they're enrolled in).
        if ($user->role === 'hoc') {
            $courseIds = CourseEnrollment::query()
                ->where('user_id', $user->id)
                ->pluck('course_id');
        } else {
            $courseIds = Course::query()
                ->where('lecturer_id', $user->id)
                ->pluck('id');
        }

        // Open any sessions that are due by schedule before reading them back.
        $this->scheduledSessions->ensureForCourseIds($courseIds);

        $courses = Course::query()
            ->whereIn('id', $courseIds)
            ->withCount(['enrollments', 'sessions'])
            ->get();

        $activeSessions = AttendanceSession::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', 'active')
            ->where('ends_at', '>', now())
            ->get();

        $today = AttendanceRecord::query()
            ->whereIn('session_id', AttendanceSession::query()->whereIn('course_id', $courseIds)->pluck('id'))
            ->whereDate('checked_in_at', now()->toDateString())
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        return response()->json([
            'message' => 'Lecturer dashboard retrieved.',
            'data' => [
                'courses' => $courses,
                'active_sessions' => $activeSessions,
                'today_counts' => [
                    'present' => (int) ($today['present'] ?? 0),
                    'late' => (int) ($today['late'] ?? 0),
                    'flagged' => (int) ($today['flagged'] ?? 0),
                    'absent' => (int) ($today['absent'] ?? 0),
                ],
            ],
        ]);
    }

    public function admin(Request $request): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json([
                'message' => 'You are not authorised to view this dashboard.',
            ], 403);
        }

        $counts = [
            'students' => User::query()->where('role', 'student')->count(),
            'lecturers' => User::query()->where('role', 'lecturer')->count(),
            'admins' => User::query()->whereIn('role', ['hoc', 'superadmin'])->count(),
            'courses' => Course::query()->count(),
            'active_sessions' => AttendanceSession::query()
                ->where('status', 'active')
                ->where('ends_at', '>', now())
                ->count(),
            'total_sessions' => AttendanceSession::query()->count(),
            'total_records' => AttendanceRecord::query()->count(),
        ];

        return response()->json([
            'message' => 'Admin dashboard retrieved.',
            'data' => ['counts' => $counts],
        ]);
    }
}
