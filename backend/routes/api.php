<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AttendanceReportController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\CourseInviteController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\FaceProfileController;
use App\Http\Controllers\Api\GeofenceController;
use App\Http\Controllers\Api\InstitutionController;
use App\Http\Controllers\Api\LecturerController;
use App\Http\Controllers\Api\PresenceCheckController;
use App\Http\Controllers\Api\PushTokenController;
use App\Http\Controllers\Api\SessionController;

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

// Public institution list — needed during registration before a token exists.
Route::get('/institutions', [InstitutionController::class, 'index']);

// ── Protected routes (require Sanctum token) ─────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // ── Institutions (write operations — superadmin only) ──────────────────
    Route::post('/institutions', [InstitutionController::class, 'store']);
    Route::get('/institutions/{institution}', [InstitutionController::class, 'show']);
    Route::patch('/institutions/{institution}', [InstitutionController::class, 'update']);
    Route::delete('/institutions/{institution}', [InstitutionController::class, 'destroy']);

    // ── Device binding (not behind bound.device — needed to bind) ──────────
    Route::prefix('devices')->group(function () {
        Route::post('/bind', [DeviceController::class, 'bind']);
        Route::get('/me', [DeviceController::class, 'me']);
        Route::post('/reset', [DeviceController::class, 'reset']);
        Route::post('/{device}/push-token', [DeviceController::class, 'setPushToken']);
    });

    // Push tokens — outside bound.device so a freshly bound device can register.
    Route::post('/push-tokens', [PushTokenController::class, 'store']);

    // ── Everything below requires a bound device ──────────────────────────
    Route::middleware('bound.device')->group(function () {

        // Courses
        Route::get('/courses', [CourseController::class, 'index']);
        Route::post('/courses', [CourseController::class, 'store']);
        Route::get('/courses/{course}', [CourseController::class, 'show']);
        Route::patch('/courses/{course}', [CourseController::class, 'update']);
        Route::delete('/courses/{course}', [CourseController::class, 'destroy']);
        Route::post('/courses/{course}/enroll', [CourseController::class, 'enroll']);
        Route::post('/courses/{course}/self-enroll', [CourseController::class, 'selfEnroll']);
        Route::delete('/courses/{course}/enroll/{userId}', [CourseController::class, 'unenroll']);
        // Student lookup for enrolment (lecturer/admin) — by email, matric or name.
        Route::get('/students/search', [CourseController::class, 'searchStudents']);

        Route::get('/courses/{course}/students', [CourseController::class, 'students']);
        Route::get('/courses/{course}/students/{userId}/attendance', [CourseController::class, 'studentAttendance']);

        // Lecturer attendance exports (CSV with present/absent + integrity score)
        Route::get('/courses/{course}/attendance/today/csv', [AttendanceReportController::class, 'todayCsv']);
        Route::get('/courses/{course}/students/{userId}/attendance/csv', [AttendanceReportController::class, 'studentCsv']);

        // Class invites / share links
        Route::post('/courses/{course}/invites', [CourseInviteController::class, 'store']);
        Route::get('/invites/{token}', [CourseInviteController::class, 'show']);
        Route::post('/invites/{token}/accept', [CourseInviteController::class, 'accept']);

        // Geofences
        Route::get('/courses/{course}/geofence', [GeofenceController::class, 'show']);
        Route::put('/courses/{course}/geofence', [GeofenceController::class, 'upsert']);

        // Sessions (course-scoped)
        Route::post('/courses/{course}/sessions', [SessionController::class, 'store']);
        Route::get('/courses/{course}/sessions', [SessionController::class, 'index']);
        Route::get('/courses/{course}/sessions/active', [SessionController::class, 'active']);

        // Sessions (direct)
        Route::get('/sessions/{session}', [SessionController::class, 'show']);
        Route::post('/sessions/{session}/close', [SessionController::class, 'close']);
        Route::get('/sessions/{session}/records', [SessionController::class, 'records']);
        Route::get('/sessions/{session}/records/csv', [AttendanceReportController::class, 'sessionCsv']);

        // Attendance
        Route::post('/sessions/{session}/checkin', [AttendanceController::class, 'checkIn']);
        Route::post('/sessions/{session}/checkout', [AttendanceController::class, 'checkOut']);
        Route::get('/sessions/{session}/my-record', [AttendanceController::class, 'myRecord']);
        Route::get('/me/attendance', [AttendanceController::class, 'myHistory']);

        // Presence checks
        Route::get('/presence-checks/pending', [PresenceCheckController::class, 'pending']);
        Route::post('/presence-checks/{check}/respond', [PresenceCheckController::class, 'respond']);
        Route::post('/sessions/{session}/presence-check', [PresenceCheckController::class, 'triggerManual']);

        // Face profile
        Route::post('/face-profile', [FaceProfileController::class, 'store']);
        Route::get('/face-profile', [FaceProfileController::class, 'show']);
        Route::delete('/face-profile', [FaceProfileController::class, 'destroy']);

        // Dashboards
        Route::get('/dashboard/student', [DashboardController::class, 'student']);
        Route::get('/dashboard/lecturer', [DashboardController::class, 'lecturer']);
        Route::get('/dashboard/admin', [DashboardController::class, 'admin']);

        // Lecturer management (admin)
        Route::get('/lecturers', [LecturerController::class, 'index']);
        Route::post('/lecturers/{id}/assign-course', [LecturerController::class, 'assignCourse']);
    });
});
