<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class DeviceController extends Controller
{
    public function bind(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_uid' => ['required', 'string', 'max:128'],
            'platform' => ['required', 'in:ios,android'],
            'brand' => ['nullable', 'string', 'max:64'],
            'model' => ['nullable', 'string', 'max:64'],
            'os_name' => ['nullable', 'string', 'max:32'],
            'os_version' => ['nullable', 'string', 'max:32'],
            'app_version' => ['nullable', 'string', 'max:32'],
            'push_token' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        try {
            $device = DB::transaction(function () use ($user, $validated) {
                $existing = Device::query()
                    ->where('user_id', $user->id)
                    ->whereNull('revoked_at')
                    ->first();

                if ($existing && $existing->device_uid !== $validated['device_uid']) {
                    return ['conflict' => true];
                }

                if ($existing && $existing->device_uid === $validated['device_uid']) {
                    $existing->fill([
                        'platform' => $validated['platform'],
                        'brand' => $validated['brand'] ?? $existing->brand,
                        'model' => $validated['model'] ?? $existing->model,
                        'os_name' => $validated['os_name'] ?? $existing->os_name,
                        'os_version' => $validated['os_version'] ?? $existing->os_version,
                        'app_version' => $validated['app_version'] ?? $existing->app_version,
                        'push_token' => $validated['push_token'] ?? $existing->push_token,
                        'last_seen_at' => now(),
                    ])->save();

                    return $existing;
                }

                // No active device — create one, revoke any older ones for safety.
                Device::query()
                    ->where('user_id', $user->id)
                    ->whereNull('revoked_at')
                    ->update(['revoked_at' => now()]);

                return Device::query()->create([
                    'user_id' => $user->id,
                    'device_uid' => $validated['device_uid'],
                    'platform' => $validated['platform'],
                    'brand' => $validated['brand'] ?? null,
                    'model' => $validated['model'] ?? null,
                    'os_name' => $validated['os_name'] ?? null,
                    'os_version' => $validated['os_version'] ?? null,
                    'app_version' => $validated['app_version'] ?? null,
                    'push_token' => $validated['push_token'] ?? null,
                    'bound_at' => now(),
                    'last_seen_at' => now(),
                ]);
            });
        } catch (Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Unable to bind device right now. Please try again.',
            ], 500);
        }

        if (is_array($device) && ($device['conflict'] ?? false)) {
            return response()->json([
                'message' => 'A device is already bound to your account. Reset device to bind a new one.',
            ], 409);
        }

        return response()->json([
            'message' => 'Device bound successfully.',
            'data' => ['device' => $device],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $devices = Device::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Devices retrieved.',
            'data' => ['devices' => $devices],
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $user = $request->user();

        $active = Device::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->get();

        foreach ($active as $device) {
            $device->update(['revoked_at' => now()]);
            Log::info('GeoTrack: device self-reset', [
                'user_id' => $user->id,
                'device_id' => $device->id,
                'device_uid' => $device->device_uid,
            ]);
        }

        return response()->json([
            'message' => 'Device reset successful. You can now bind a new device.',
            'data' => ['revoked' => $active->count()],
        ]);
    }

    public function setPushToken(Request $request, Device $device): JsonResponse
    {
        $validated = $request->validate([
            'push_token' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        if ($device->user_id !== $user->id) {
            return response()->json([
                'message' => 'Device does not belong to the authenticated user.',
            ], 403);
        }

        $device->update(['push_token' => $validated['push_token']]);

        PushToken::query()->updateOrCreate(
            ['token' => $validated['push_token']],
            [
                'user_id' => $user->id,
                'device_id' => $device->id,
                'platform' => $device->platform,
            ]
        );

        return response()->json([
            'message' => 'Push token updated.',
            'data' => ['device' => $device->fresh()],
        ]);
    }
}
