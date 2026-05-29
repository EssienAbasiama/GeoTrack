<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FaceProfile;
use App\Services\FaceMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class FaceProfileController extends Controller
{
    public function __construct(private readonly FaceMatchService $faceMatch)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'face_image_base64' => ['required', 'string'],
        ]);

        $user = $request->user();

        try {
            $result = $this->faceMatch->enroll($user, $validated['face_image_base64']);
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to enroll face right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Face profile saved.',
            'data' => [
                'provider' => $result['provider'],
                'profile' => $user->faceProfile()->first(),
            ],
        ], 201);
    }

    public function show(Request $request): JsonResponse
    {
        $profile = FaceProfile::query()->where('user_id', $request->user()->id)->first();

        return response()->json([
            'message' => $profile ? 'Face profile retrieved.' : 'No face profile enrolled.',
            'data' => [
                'profile' => $profile,
                'driver' => $this->faceMatch->driver(),
            ],
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        FaceProfile::query()->where('user_id', $request->user()->id)->delete();

        return response()->json([
            'message' => 'Face profile deleted.',
        ]);
    }
}
