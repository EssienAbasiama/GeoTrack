<?php

namespace App\Http\Middleware;

use App\Models\Device;
use App\Models\DeviceBindingEvent;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBoundDevice
{
    /**
     * Verify the request originates from the authenticated user's bound device.
     * Expects an "X-Device-UID" header.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'message' => 'Authentication required.',
            ], 401);
        }

        // Superadmins and lecturers manage from any device. Students AND HOCs are
        // locked to a bound device — an HOC marks attendance like a student, so
        // they need the same device integrity guarantee.
        if ($user->isSuperAdmin() || $user->role === 'lecturer') {
            return $next($request);
        }

        $deviceUid = (string) $request->header('X-Device-UID', '');
        if ($deviceUid === '') {
            return response()->json([
                'message' => 'Device not bound or does not match.',
            ], 403);
        }

        $device = Device::query()
            ->where('user_id', $user->id)
            ->where('device_uid', $deviceUid)
            ->whereNull('revoked_at')
            ->first();

        // Simulation mode: never lock a student out over device binding. Revoke
        // any stale binding and adopt the device presenting this request, so a
        // student can take part from whatever phone they have on the day.
        if (!$device && config('geotrack.demo_mode')) {
            $previousUid = Device::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->value('device_uid');

            try {
                DeviceBindingEvent::record(
                    $user->id,
                    $previousUid ? 'rebound' : 'bound',
                    $previousUid,
                    $deviceUid,
                    null,
                    'auto_adopt',
                );
            } catch (\Throwable $e) {
                report($e); // auditing must never block the request
            }

            Device::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $device = Device::query()->create([
                'user_id' => $user->id,
                'device_uid' => $deviceUid,
                'platform' => 'android',
                'bound_at' => now(),
                'last_seen_at' => now(),
            ]);
        }

        if (!$device) {
            return response()->json([
                'message' => 'Device not bound or does not match.',
            ], 403);
        }

        $device->forceFill(['last_seen_at' => now()])->save();
        $request->attributes->set('bound_device', $device);

        return $next($request);
    }
}
