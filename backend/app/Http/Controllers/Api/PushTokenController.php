<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'device_uid' => ['required', 'string', 'max:128'],
            'platform' => ['required', 'in:ios,android'],
        ]);

        $user = $request->user();

        $device = Device::query()
            ->where('user_id', $user->id)
            ->where('device_uid', $validated['device_uid'])
            ->whereNull('revoked_at')
            ->first();

        if (!$device) {
            return response()->json([
                'message' => 'No active device matches the supplied device_uid.',
            ], 422);
        }

        $pushToken = PushToken::query()->updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id' => $user->id,
                'device_id' => $device->id,
                'platform' => $validated['platform'],
            ]
        );

        $device->update(['push_token' => $validated['token']]);

        return response()->json([
            'message' => 'Push token registered.',
            'data' => ['push_token' => $pushToken],
        ], 201);
    }
}
