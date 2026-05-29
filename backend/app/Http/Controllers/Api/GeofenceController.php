<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseGeofence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeofenceController extends Controller
{
    public function show(Request $request, Course $course): JsonResponse
    {
        $fence = $course->geofence;
        return response()->json([
            'message' => $fence ? 'Geofence retrieved.' : 'No geofence configured for this course.',
            'data' => ['geofence' => $fence],
        ]);
    }

    public function upsert(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to update this geofence.',
            ], 403);
        }

        $validated = $request->validate([
            'shape' => ['required', 'in:circle,polygon'],
            'label' => ['required', 'string', 'max:128'],
            'center_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'center_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_m' => ['nullable', 'integer', 'min:5', 'max:5000'],
            'polygon' => ['nullable', 'array', 'min:3'],
            'polygon.*.latitude' => ['required_with:polygon', 'numeric', 'between:-90,90'],
            'polygon.*.longitude' => ['required_with:polygon', 'numeric', 'between:-180,180'],
        ]);

        if ($validated['shape'] === 'circle') {
            if (!isset($validated['center_lat'], $validated['center_lng'])) {
                return response()->json([
                    'message' => 'Circle geofences require center_lat, center_lng and radius_m.',
                ], 422);
            }
        } else {
            if (empty($validated['polygon']) || count($validated['polygon']) < 3) {
                return response()->json([
                    'message' => 'Polygon geofences require at least 3 points.',
                ], 422);
            }
        }

        $fence = CourseGeofence::query()->updateOrCreate(
            ['course_id' => $course->id],
            [
                'shape' => $validated['shape'],
                'label' => $validated['label'],
                'center_lat' => $validated['shape'] === 'circle' ? $validated['center_lat'] : null,
                'center_lng' => $validated['shape'] === 'circle' ? $validated['center_lng'] : null,
                'radius_m' => $validated['shape'] === 'circle' ? ($validated['radius_m'] ?? 50) : null,
                'polygon_json' => $validated['shape'] === 'polygon' ? $validated['polygon'] : null,
            ]
        );

        return response()->json([
            'message' => 'Geofence saved.',
            'data' => ['geofence' => $fence],
        ]);
    }
}
