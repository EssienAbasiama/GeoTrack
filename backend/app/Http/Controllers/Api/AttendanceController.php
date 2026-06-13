<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\CourseEnrollment;
use App\Models\Device;
use App\Models\FaceProfile;
use App\Services\FaceMatchService;
use App\Services\GeofenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly GeofenceService $geofence,
        private readonly FaceMatchService $faceMatch,
    ) {
    }

    public function checkIn(Request $request, AttendanceSession $session): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'face_image_base64' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $course = $session->course;

        // Time window
        $now = now();
        if ($session->status !== 'active' || $session->starts_at?->isFuture() || $session->ends_at?->isPast()) {
            return response()->json([
                'message' => 'This session is not currently accepting check-ins.',
            ], 422);
        }

        // Enrollment
        $isEnrolled = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists();
        if (!$isEnrolled) {
            return response()->json([
                'message' => 'You are not enrolled in this course.',
            ], 403);
        }

        // Bound device — read from middleware attribute, else look up directly.
        /** @var Device|null $device */
        $device = $request->attributes->get('bound_device');
        if (!$device) {
            $deviceUid = (string) $request->header('X-Device-UID', '');
            $device = Device::query()
                ->where('user_id', $user->id)
                ->where('device_uid', $deviceUid)
                ->whereNull('revoked_at')
                ->first();
        }
        if (!$device) {
            return response()->json([
                'message' => 'Device not bound or does not match.',
            ], 403);
        }

        // Geofence
        $fence = $course->geofence;
        if (!$fence) {
            return response()->json([
                'message' => 'This course has no configured venue. Contact your lecturer.',
            ], 422);
        }

        $geo = $this->geofence->evaluate($fence, (float) $validated['latitude'], (float) $validated['longitude']);
        if (!$geo['inside']) {
            return response()->json([
                'message' => 'You are not within the class venue.',
                'data' => [
                    'distance_m' => $geo['distance_m'],
                ],
            ], 422);
        }

        // Face validation — ensures the person checking in is really the student.
        // A face image is required for face_recognition sessions, and whenever the
        // app sends one (the GeoTrack app always captures a selfie at check-in) it
        // is verified against the student's enrolled face.
        $faceVerified = false;
        $faceConfidence = null;
        $faceImagePath = null;

        $hasFaceImage = !empty($validated['face_image_base64']);

        if ($session->mode === 'face_recognition' && !$hasFaceImage) {
            return response()->json([
                'message' => 'Face image required for this session mode.',
            ], 422);
        }

        if ($hasFaceImage) {
            // The student must have enrolled a reference face to verify against.
            $hasProfile = FaceProfile::query()->where('user_id', $user->id)->exists();
            if (!$hasProfile) {
                return response()->json([
                    'message' => 'Enroll your face before checking in so we can verify it\'s you.',
                    'data' => ['face_enrollment_required' => true],
                ], 422);
            }

            $verifyResult = $this->faceMatch->verify($user, $validated['face_image_base64']);
            $faceVerified = (bool) $verifyResult['matched'];
            $faceConfidence = (float) $verifyResult['confidence'];
            $faceImagePath = $verifyResult['image_path'] ?? null;
            if (!$faceVerified) {
                return response()->json([
                    'message' => 'Face verification failed — make sure it\'s really you and try again.',
                    'data' => ['confidence' => $faceConfidence, 'face_verification_failed' => true],
                ], 422);
            }
        }

        // Determine status
        $minutesLate = $session->starts_at ? $session->starts_at->diffInMinutes($now, false) : 0;
        $status = $minutesLate <= (int) $session->late_after_minutes ? 'present' : 'late';

        try {
            $record = DB::transaction(function () use ($session, $user, $device, $validated, $geo, $now, $status, $faceVerified, $faceConfidence, $faceImagePath) {
                return AttendanceRecord::query()->updateOrCreate(
                    ['session_id' => $session->id, 'user_id' => $user->id],
                    [
                        'device_id' => $device->id,
                        'status' => $status,
                        'checked_in_at' => $now,
                        'check_in_lat' => $validated['latitude'],
                        'check_in_lng' => $validated['longitude'],
                        'check_in_accuracy_m' => $validated['accuracy'] ?? null,
                        'distance_from_center_m' => $geo['distance_m'],
                        'within_geofence' => $geo['inside'],
                        'face_verified' => $faceVerified,
                        'face_confidence' => $faceConfidence,
                        'face_image_path' => $faceImagePath,
                        'present_throughout' => true,
                    ]
                );
            });
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to record attendance right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Attendance recorded.',
            'data' => ['record' => $record],
        ], 201);
    }

    public function myRecord(Request $request, AttendanceSession $session): JsonResponse
    {
        $record = AttendanceRecord::query()
            ->where('session_id', $session->id)
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'message' => $record ? 'Attendance record retrieved.' : 'No attendance record for this session.',
            'data' => ['record' => $record],
        ]);
    }

    public function myHistory(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $paginator = AttendanceRecord::query()
            ->with([
                'session:id,course_id,starts_at,ends_at,mode',
                'session.course:id,code,title',
            ])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('checked_in_at')
            ->paginate(min($perPage, 100));

        return response()->json([
            'message' => 'Attendance history retrieved.',
            'data' => [
                'records' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
        ]);
    }
}
