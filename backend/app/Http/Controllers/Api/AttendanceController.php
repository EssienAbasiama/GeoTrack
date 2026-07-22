<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceEvent;
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
            'demo_bypass' => ['nullable', 'boolean'],
        ]);

        // Simulation override: honoured only when the server is in demo mode AND
        // the app's hidden toggle sent demo_bypass. Skips face verification and
        // guarantees a bound device, so a classroom simulation always completes.
        $demo = config('geotrack.demo_mode') && $request->boolean('demo_bypass');

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
        if (!$device && $demo) {
            // In a simulation, never block on device binding — bind the current
            // device (or a placeholder) on the fly so the record has a device.
            $deviceUid = (string) $request->header('X-Device-UID', '') ?: 'demo-' . $user->id;
            $device = Device::query()->firstOrCreate(
                ['user_id' => $user->id, 'device_uid' => $deviceUid],
                ['platform' => 'android', 'bound_at' => now(), 'last_seen_at' => now()],
            );
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

        if ($demo) {
            // Simulation override — treat identity as verified, skip all matching.
            $faceVerified = true;
        } elseif ($session->mode === 'face_recognition' && !$hasFaceImage) {
            return response()->json([
                'message' => 'Face image required for this session mode.',
            ], 422);
        }

        if (!$demo && $hasFaceImage) {
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
                $existing = AttendanceRecord::query()
                    ->where('session_id', $session->id)
                    ->where('user_id', $user->id)
                    ->first();

                // Re-entry: a student who clocked out of a still-running class can
                // clock back in. Keep their original arrival time and status so
                // stepping out never turns an on-time student "late", and clear the
                // checkout so they count as present again.
                $isReEntry = $existing && $existing->checked_in_at;
                $checkedInAt = $isReEntry ? $existing->checked_in_at : $now;
                $finalStatus = $isReEntry ? $existing->status : $status;

                $record = AttendanceRecord::query()->updateOrCreate(
                    ['session_id' => $session->id, 'user_id' => $user->id],
                    [
                        'device_id' => $device->id,
                        'status' => $finalStatus,
                        'checked_in_at' => $checkedInAt,
                        // Clearing this is what actually re-opens the check-in.
                        'checked_out_at' => null,
                        'check_in_lat' => $validated['latitude'],
                        'check_in_lng' => $validated['longitude'],
                        'check_in_accuracy_m' => $validated['accuracy'] ?? null,
                        'distance_from_center_m' => $geo['distance_m'],
                        'within_geofence' => $geo['inside'],
                        'face_verified' => $faceVerified,
                        'face_confidence' => $faceConfidence,
                        'face_image_path' => $faceImagePath,
                        'present_throughout' => true,
                        're_entry_count' => ($existing?->re_entry_count ?? 0) + ($isReEntry ? 1 : 0),
                        // Starts the clock on this stint; checkOut banks it.
                        'last_entry_at' => $now,
                    ]
                );

                AttendanceEvent::query()->create([
                    'attendance_record_id' => $record->id,
                    'session_id' => $session->id,
                    'user_id' => $user->id,
                    'device_id' => $device->id,
                    'type' => $isReEntry ? AttendanceEvent::RE_ENTRY : AttendanceEvent::CHECK_IN,
                    'occurred_at' => $now,
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'within_geofence' => $geo['inside'],
                ]);

                return $record;
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

    public function checkOut(Request $request, AttendanceSession $session): JsonResponse
    {
        $user = $request->user();

        $record = AttendanceRecord::query()
            ->where('session_id', $session->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$record || !$record->checked_in_at) {
            return response()->json([
                'message' => 'You have not checked in to this session.',
            ], 422);
        }

        if ($record->checked_out_at) {
            return response()->json([
                'message' => 'You have already checked out.',
                'data' => ['record' => $record],
            ]);
        }

        $now = now();

        // Bank the stint that just ended so time-in-class survives a re-entry
        // (which clears checked_out_at and starts a fresh stint).
        $stintStart = $record->last_entry_at ?? $record->checked_in_at;
        if ($stintStart && $now->greaterThan($stintStart)) {
            $record->minutes_present = (int) $record->minutes_present
                + (int) round($stintStart->diffInMinutes($now));
        }

        $record->checked_out_at = $now;
        $record->last_entry_at = null;
        $record->save();

        AttendanceEvent::query()->create([
            'attendance_record_id' => $record->id,
            'session_id' => $session->id,
            'user_id' => $user->id,
            'device_id' => $record->device_id,
            'type' => AttendanceEvent::CHECK_OUT,
            'occurred_at' => $now,
            'latitude' => $record->check_in_lat,
            'longitude' => $record->check_in_lng,
            'within_geofence' => (bool) $record->within_geofence,
        ]);

        return response()->json([
            'message' => 'Checked out successfully.',
            'data' => ['record' => $record],
        ]);
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
                'events',
            ])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('checked_in_at')
            ->paginate(min($perPage, 100));

        // Surface the in-and-out trail alongside each record so the history
        // screen can show real check-out times and time actually spent in class.
        $records = collect($paginator->items())->map(function (AttendanceRecord $record) {
            $data = $record->toArray();
            $data['minutes_present'] = $record->minutesPresent($record->session?->ends_at);
            $data['still_in_class'] = !$record->checked_out_at && (bool) $record->last_entry_at;
            $data['events'] = $record->events
                ->sortBy('occurred_at')
                ->map(fn (AttendanceEvent $e) => [
                    'type' => $e->type,
                    'label' => $e->label(),
                    'occurred_at' => $e->occurred_at?->toIso8601String(),
                    'within_geofence' => (bool) $e->within_geofence,
                ])->values();
            return $data;
        })->values();

        return response()->json([
            'message' => 'Attendance history retrieved.',
            'data' => [
                'records' => $records,
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
