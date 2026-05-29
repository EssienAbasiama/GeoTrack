<?php

namespace App\Http\Middleware;

use App\Models\Device;
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

        // Admins (hoc, superadmin) and lecturers can act from any device for
        // dashboard/management routes; only students are strictly locked to
        // their bound device for attendance integrity.
        if (method_exists($user, 'isAdmin') && ($user->isAdmin() || $user->role === 'lecturer')) {
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
