<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LecturerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json([
                'message' => 'You are not authorised to view lecturers.',
            ], 403);
        }

        $lecturers = User::query()
            ->where('role', 'lecturer')
            ->withCount(['lecturerCourses as courses_count'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'created_at']);

        return response()->json([
            'message' => 'Lecturers retrieved.',
            'data' => ['lecturers' => $lecturers],
        ]);
    }

    public function assignCourse(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return response()->json([
                'message' => 'You are not authorised to assign courses.',
            ], 403);
        }

        $validated = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
        ]);

        $lecturer = User::query()->find($id);
        if (!$lecturer || $lecturer->role !== 'lecturer') {
            return response()->json([
                'message' => 'Lecturer not found.',
            ], 404);
        }

        $course = Course::query()->find($validated['course_id']);
        $course->update(['lecturer_id' => $lecturer->id]);

        return response()->json([
            'message' => 'Course assigned to lecturer.',
            'data' => ['course' => $course->fresh('lecturer:id,name,email')],
        ]);
    }
}
