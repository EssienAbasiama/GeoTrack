<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — GeoTrack
|--------------------------------------------------------------------------
|
| All routes here are prefixed with /api automatically.
| Protected routes require a valid Sanctum token:
|   Authorization: Bearer <token>
|
*/

// ── Public routes ────────────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    // POST /api/auth/register
    // POST /api/auth/login
    // (controllers to be added)
});

// ── Protected routes (require Sanctum token) ─────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Return the authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // POST /api/auth/logout
    Route::post('/auth/logout', function (Request $request) {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    });

    // ── Attendance routes (to be implemented) ─────────────────────────────
    // Route::apiResource('sessions', AttendanceSessionController::class);
    // Route::post('sessions/{session}/checkin', [AttendanceController::class, 'checkIn']);
});
