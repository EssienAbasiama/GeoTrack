<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\CourseInvite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CourseInviteController extends Controller
{
    /**
     * Create (or reuse) a shareable invite link for a course.
     *  - role=student : enrolls the recipient as a class member.
     *  - role=lecturer: assigns the recipient as the class lecturer (HOD only).
     */
    public function store(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'role' => ['required', 'in:student,lecturer'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);
        $role = $validated['role'];

        $isOwnerLecturer = $course->lecturer_id === $user->id;

        if ($role === 'lecturer') {
            // Only an HOD (HOC / superadmin) may invite/assign a lecturer.
            if (!$user->isAdmin()) {
                return response()->json([
                    'message' => 'Only an HOD can share a lecturer invite.',
                ], 403);
            }
        } else {
            // Student invites: HOD or the owning lecturer.
            if (!$user->isAdmin() && !$isOwnerLecturer) {
                return response()->json([
                    'message' => 'You are not authorised to share this class.',
                ], 403);
            }
        }

        $expiresAt = isset($validated['expires_in_days'])
            ? now()->addDays($validated['expires_in_days'])
            : null;

        // Reuse a still-valid invite for this course + role so links stay stable.
        $invite = CourseInvite::query()
            ->where('course_id', $course->id)
            ->where('role', $role)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest()
            ->first();

        if (!$invite) {
            $invite = CourseInvite::query()->create([
                'course_id' => $course->id,
                'role' => $role,
                'token' => Str::random(40),
                'created_by' => $user->id,
                'expires_at' => $expiresAt,
            ]);
        }

        $invite->load(['course.lecturer:id,name,email', 'course.institution:id,name,code']);

        return response()->json([
            'message' => 'Invite link ready.',
            'data' => ['invite' => $this->payload($invite)],
        ], 201);
    }

    /** Preview an invite before accepting (class name, role, institution). */
    public function show(Request $request, string $token): JsonResponse
    {
        $invite = CourseInvite::query()
            ->where('token', $token)
            ->with(['course.lecturer:id,name,email', 'course.institution:id,name,code'])
            ->first();

        if (!$invite || $invite->isExpired() || !$invite->course) {
            return response()->json([
                'message' => 'This invite link is invalid or has expired.',
            ], 404);
        }

        return response()->json([
            'message' => 'Invite retrieved.',
            'data' => ['invite' => $this->payload($invite)],
        ]);
    }

    /** Accept an invite: enroll the student, or assign the lecturer. */
    public function accept(Request $request, string $token): JsonResponse
    {
        $user = $request->user();

        $invite = CourseInvite::query()
            ->where('token', $token)
            ->with('course')
            ->first();

        if (!$invite || $invite->isExpired() || !$invite->course) {
            return response()->json([
                'message' => 'This invite link is invalid or has expired.',
            ], 404);
        }

        $course = $invite->course;

        // Same-institution guard (superadmin bypasses).
        if (
            !$user->isSuperAdmin()
            && $course->institution_id
            && $user->institution_id !== $course->institution_id
        ) {
            return response()->json([
                'message' => 'This class belongs to a different institution.',
            ], 403);
        }

        if ($invite->role === 'lecturer') {
            if (!$user->isLecturer()) {
                return response()->json([
                    'message' => 'Only a lecturer can accept a lecturer invite.',
                ], 422);
            }
            $course->lecturer_id = $user->id;
            $course->save();
            $message = 'You are now the lecturer for this class.';
        } else {
            if (!$user->isStudent() && $user->role !== 'hoc') {
                return response()->json([
                    'message' => 'Only students can join this class.',
                ], 422);
            }
            CourseEnrollment::query()->firstOrCreate(
                ['course_id' => $course->id, 'user_id' => $user->id],
                ['enrolled_at' => now()],
            );
            $message = 'You have joined the class.';
        }

        return response()->json([
            'message' => $message,
            'data' => [
                'role' => $invite->role,
                'course' => $course->fresh(['lecturer:id,name,email', 'geofence']),
            ],
        ]);
    }

    private function payload(CourseInvite $invite): array
    {
        $c = $invite->course;

        return [
            'token' => $invite->token,
            'role' => $invite->role,
            'expires_at' => $invite->expires_at,
            'course' => $c ? [
                'id' => $c->id,
                'code' => $c->code,
                'title' => $c->title,
                'department' => $c->department,
                'venue' => $c->venue,
                'lecturer_name' => $c->lecturer?->name,
                'institution' => $c->institution ? [
                    'id' => $c->institution->id,
                    'name' => $c->institution->name,
                    'code' => $c->institution->code,
                ] : null,
            ] : null,
        ];
    }
}
