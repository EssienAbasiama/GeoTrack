<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;

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
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/verify-email-code', [AuthController::class, 'verifyEmailCode']);
    Route::post('/resend-email-code', [AuthController::class, 'resendEmailCode']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// ── Protected routes (require Sanctum token) ─────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Return the authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // ── Attendance routes (to be implemented) ─────────────────────────────
    // Route::apiResource('sessions', AttendanceSessionController::class);
    // Route::post('sessions/{session}/checkin', [AttendanceController::class, 'checkIn']);
});
