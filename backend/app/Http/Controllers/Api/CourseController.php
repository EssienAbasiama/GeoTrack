<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Institution;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Course::query()->with(['lecturer:id,name,email', 'geofence', 'institution:id,name,code']);

        // Scope to the user's institution unless they are a superadmin.
        // Users without an institution_id (legacy / superadmin) see all courses
        // that match their role filter below.
        if (!$user->isSuperAdmin() && $user->institution_id) {
            $query->where('institution_id', $user->institution_id);
        }

        if ($user->isAdmin()) {
            // Institution already filtered above; admins see all courses within it.
        } elseif ($user->isLecturer()) {
            $query->where('lecturer_id', $user->id);
        } else {
            $enrolledIds = CourseEnrollment::query()
                ->where('user_id', $user->id)
                ->pluck('course_id');
            $query->whereIn('id', $enrolledIds);
        }

        $courses = $query->orderBy('code')->get();

        return response()->json([
            'message' => 'Courses retrieved.',
            'data' => ['courses' => $courses],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isLecturer()) {
            return response()->json([
                'message' => 'You are not authorised to create courses.',
            ], 403);
        }

        $validated = $request->validate([
            'code'           => ['required', 'string', 'max:32', 'unique:courses,code'],
            'title'          => ['required', 'string', 'max:255'],
            'description'    => ['nullable', 'string'],
            'department'     => ['nullable', 'string', 'max:128'],
            'level'          => ['nullable', 'string', 'max:32'],
            'lecturer_id'    => ['nullable', 'integer', 'exists:users,id'],
            'venue'          => ['nullable', 'string', 'max:255'],
            'day'            => ['nullable', 'string', 'max:16'],
            'start_time'     => ['nullable', 'string', 'max:8'],
            'end_time'       => ['nullable', 'string', 'max:8'],
            'institution_id' => ['nullable', 'integer', 'exists:institutions,id'],
        ]);

        // Resolve institution_id:
        // - Superadmin must supply it explicitly.
        // - Everyone else inherits it from their own profile.
        if ($user->isSuperAdmin()) {
            if (empty($validated['institution_id'])) {
                return response()->json([
                    'message' => 'institution_id is required when creating a course as super admin.',
                ], 422);
            }
            $institutionId = $validated['institution_id'];
        } else {
            $institutionId = $user->institution_id;
        }

        // Lecturers are always assigned to their own course; only admins can assign another lecturer.
        if ($user->isLecturer()) {
            $validated['lecturer_id'] = $user->id;
        } elseif (!empty($validated['lecturer_id'])) {
            $lecturer = User::query()->find($validated['lecturer_id']);
            if (!$lecturer || $lecturer->role !== 'lecturer') {
                return response()->json([
                    'message' => 'Assigned user must have the lecturer role.',
                ], 422);
            }
        }

        try {
            $course = DB::transaction(function () use ($validated, $user, $institutionId) {
                $course = Course::query()->create([
                    'institution_id' => $institutionId,
                    'code'           => $validated['code'],
                    'title'          => $validated['title'],
                    'description'    => $validated['description'] ?? null,
                    'department'     => $validated['department'] ?? null,
                    'level'          => $validated['level'] ?? null,
                    'lecturer_id'    => $validated['lecturer_id'] ?? null,
                    'venue'          => $validated['venue'] ?? null,
                    'day'            => $validated['day'] ?? null,
                    'start_time'     => $validated['start_time'] ?? null,
                    'end_time'       => $validated['end_time'] ?? null,
                    'created_by'     => $user->id,
                ]);

                // HOC is a student in their own class — auto-enroll them.
                if ($user->role === 'hoc') {
                    CourseEnrollment::query()->firstOrCreate(
                        ['course_id' => $course->id, 'user_id' => $user->id],
                        ['enrolled_at' => now()],
                    );
                }

                return $course;
            });
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to create course right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Course created.',
            'data' => ['course' => $course->load('lecturer:id,name,email')],
        ], 201);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();

        $isEnrolled = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists();

        $isOwnLecturer = $course->lecturer_id === $user->id;

        if (!$user->isAdmin() && !$isOwnLecturer && !$isEnrolled) {
            return response()->json([
                'message' => 'You do not have access to this course.',
            ], 403);
        }

        $course->load(['lecturer:id,name,email', 'geofence']);

        return response()->json([
            'message' => 'Course retrieved.',
            'data' => ['course' => $course],
        ]);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to update this course.',
            ], 403);
        }

        $validated = $request->validate([
            'code' => ['sometimes', 'string', 'max:32', 'unique:courses,code,' . $course->id],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'department' => ['sometimes', 'string', 'max:128'],
            'level' => ['nullable', 'string', 'max:32'],
            'lecturer_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'venue' => ['sometimes', 'nullable', 'string', 'max:255'],
            'day' => ['sometimes', 'nullable', 'string', 'max:16'],
            'start_time' => ['sometimes', 'nullable', 'string', 'max:8'],
            'end_time' => ['sometimes', 'nullable', 'string', 'max:8'],
        ]);

        if (array_key_exists('lecturer_id', $validated) && !$user->isAdmin()) {
            unset($validated['lecturer_id']);
        }

        $course->fill($validated)->save();

        return response()->json([
            'message' => 'Course updated.',
            'data' => ['course' => $course->fresh(['lecturer:id,name,email', 'geofence'])],
        ]);
    }

    public function destroy(Request $request, Course $course): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json([
                'message' => 'You are not authorised to delete this course.',
            ], 403);
        }

        $course->delete();

        return response()->json([
            'message' => 'Course deleted.',
        ]);
    }

    public function enroll(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to enroll students in this course.',
            ], 403);
        }

        $validated = $request->validate([
            'matric_no' => ['nullable', 'string', 'max:64'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (empty($validated['matric_no']) && empty($validated['user_id'])) {
            return response()->json([
                'message' => 'Provide either matric_no or user_id.',
            ], 422);
        }

        $student = !empty($validated['user_id'])
            ? User::query()->find($validated['user_id'])
            : User::query()->where('matric_no', $validated['matric_no'])->first();

        if (!$student) {
            return response()->json([
                'message' => 'Student not found.',
            ], 404);
        }

        if ($student->role !== 'student') {
            return response()->json([
                'message' => 'Only users with the student role can be enrolled.',
            ], 422);
        }

        $enrollment = CourseEnrollment::query()->firstOrCreate(
            ['course_id' => $course->id, 'user_id' => $student->id],
            ['enrolled_at' => now()]
        );

        return response()->json([
            'message' => 'Student enrolled.',
            'data' => ['enrollment' => $enrollment, 'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'matric_no' => $student->matric_no,
            ]],
        ], 201);
    }

    public function selfEnroll(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        if (!$user->isStudent()) {
            return response()->json([
                'message' => 'Only students can self-enroll.',
            ], 403);
        }

        $enrollment = CourseEnrollment::query()->firstOrCreate(
            ['course_id' => $course->id, 'user_id' => $user->id],
            ['enrolled_at' => now()]
        );

        return response()->json([
            'message' => 'Enrolled successfully.',
            'data' => ['enrollment' => $enrollment],
        ], 201);
    }

    public function unenroll(Request $request, Course $course, int $userId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id && $user->id !== $userId) {
            return response()->json([
                'message' => 'You are not authorised to remove this enrollment.',
            ], 403);
        }

        CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $userId)
            ->delete();

        return response()->json([
            'message' => 'Enrollment removed.',
        ]);
    }

    public function students(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        $isEnrolled = $course->enrollments()->where('user_id', $user->id)->exists();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id && !$isEnrolled) {
            return response()->json([
                'message' => 'You are not authorised to view this roster.',
            ], 403);
        }

        $sessionIds = $course->sessions()->pluck('id');
        $sessionCount = $sessionIds->count();

        $students = $course->students()->orderBy('name')->get();
        $attendedCounts = [];
        if ($sessionCount > 0) {
            $attendedCounts = DB::table('attendance_records')
                ->whereIn('session_id', $sessionIds)
                ->whereIn('status', ['present', 'late'])
                ->select('user_id', DB::raw('COUNT(*) as attended'))
                ->groupBy('user_id')
                ->pluck('attended', 'user_id')
                ->all();
        }

        $payload = $students->map(function (User $student) use ($attendedCounts, $sessionCount) {
            $attended = (int) ($attendedCounts[$student->id] ?? 0);
            return [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'matric_no' => $student->matric_no,
                'attended_sessions' => $attended,
                'total_sessions' => $sessionCount,
                'attendance_rate' => $sessionCount > 0
                    ? round($attended / $sessionCount * 100, 2)
                    : 0.0,
            ];
        });

        return response()->json([
            'message' => 'Course students retrieved.',
            'data' => ['students' => $payload, 'total_sessions' => $sessionCount],
        ]);
    }
}
