<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\PresenceCheck;
use App\Models\PresenceResponse;
use App\Services\FaceMatchService;
use App\Services\GeofenceService;
use App\Services\PushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class PresenceCheckController extends Controller
{
    public function __construct(
        private readonly GeofenceService $geofence,
        private readonly FaceMatchService $faceMatch,
        private readonly PushService $push,
    ) {
    }

    public function pending(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = now();

        $responses = PresenceResponse::query()
            ->with(['presenceCheck.session.course:id,code,title'])
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->whereHas('presenceCheck', function ($q) use ($now) {
                $q->where('expires_at', '>', $now);
            })
            ->get();

        return response()->json([
            'message' => 'Pending presence checks retrieved.',
            'data' => ['responses' => $responses],
        ]);
    }

    public function respond(Request $request, PresenceCheck $check): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'face_image_base64' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $now = now();

        if ($check->expires_at && $check->expires_at->isPast()) {
            return response()->json([
                'message' => 'This presence check has expired.',
            ], 422);
        }

        $response = PresenceResponse::query()
            ->where('presence_check_id', $check->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$response) {
            return response()->json([
                'message' => 'You are not a target of this presence check.',
            ], 403);
        }

        $session = $check->session;
        $course = $session?->course;
        $fence = $course?->geofence;
        if (!$fence) {
            return response()->json([
                'message' => 'Unable to evaluate presence — course has no geofence.',
            ], 422);
        }

        $geo = $this->geofence->evaluate($fence, (float) $validated['latitude'], (float) $validated['longitude']);
        $faceVerified = false;
        $faceConfidence = null;
        $faceImagePath = null;
        if (!empty($validated['face_image_base64'])) {
            $result = $this->faceMatch->verify($user, $validated['face_image_base64']);
            $faceVerified = (bool) $result['matched'];
            $faceConfidence = (float) $result['confidence'];
            $faceImagePath = $result['image_path'] ?? null;
        }

        // For face_recognition sessions, presence must include a verified face.
        $needsFace = $session->mode === 'face_recognition';
        $status = (!$geo['inside'] || ($needsFace && !$faceVerified)) ? 'failed' : 'verified';

        try {
            DB::transaction(function () use ($response, $now, $validated, $geo, $faceVerified, $faceConfidence, $faceImagePath, $status, $check, $session) {
                $response->update([
                    'responded_at' => $now,
                    'response_lat' => $validated['latitude'],
                    'response_lng' => $validated['longitude'],
                    'within_geofence' => $geo['inside'],
                    'face_verified' => $faceVerified,
                    'face_confidence' => $faceConfidence,
                    'face_image_path' => $faceImagePath,
                    'status' => $status,
                ]);

                $record = AttendanceRecord::query()
                    ->where('session_id', $check->session_id)
                    ->where('user_id', $response->user_id)
                    ->first();

                if ($record && $status === 'failed') {
                    $missed = (int) $record->missed_checks + 1;
                    $record->update([
                        'missed_checks' => $missed,
                        'present_throughout' => false,
                    ]);
                }
            });
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to record presence response. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Presence response recorded.',
            'data' => ['response' => $response->fresh()],
        ]);
    }

    public function triggerManual(Request $request, AttendanceSession $session): JsonResponse
    {
        $user = $request->user();
        $course = $session->course;
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to trigger a presence check.',
            ], 403);
        }

        if ($session->status !== 'active') {
            return response()->json([
                'message' => 'Presence checks can only be triggered on an active session.',
            ], 422);
        }

        $targetIds = AttendanceRecord::query()
            ->where('session_id', $session->id)
            ->whereIn('status', ['present', 'late'])
            ->pluck('user_id')
            ->all();

        if (empty($targetIds)) {
            return response()->json([
                'message' => 'No students have checked in yet for this session.',
            ], 422);
        }

        $check = DB::transaction(function () use ($session, $targetIds) {
            $now = now();
            $created = PresenceCheck::query()->create([
                'session_id' => $session->id,
                'triggered_at' => $now,
                'expires_at' => Carbon::parse($now)->addMinutes(5),
                'trigger_type' => 'manual',
                'targeted_user_ids' => $targetIds,
            ]);

            foreach ($targetIds as $userId) {
                PresenceResponse::query()->updateOrCreate(
                    [
                        'presence_check_id' => $created->id,
                        'user_id' => $userId,
                    ],
                    ['status' => 'pending']
                );
            }
            return $created;
        });

        $this->push->sendToUsers(
            $targetIds,
            'GeoTrack presence check',
            'Confirm you are still in class.',
            ['type' => 'presence_check', 'session_id' => $session->id]
        );

        return response()->json([
            'message' => 'Presence check triggered.',
            'data' => ['presence_check' => $check],
        ], 201);
    }
}
