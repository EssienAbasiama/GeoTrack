# GeoTrack — Backend Guidelines

> Last updated: 2026-03-15

---

## Stack

| Tool            | Version                               |
| --------------- | ------------------------------------- |
| PHP             | 8.5                                   |
| Laravel         | 12                                    |
| Laravel Sanctum | ^4.3                                  |
| Database        | MySQL 8 (production) / SQLite (local) |
| Composer        | 2.x                                   |

---

## Folder Structure

```
backend/
│
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/               # AuthController (register, login, logout)
│   │   │   ├── AttendanceController.php
│   │   │   ├── SessionController.php
│   │   │   └── DeviceController.php
│   │   ├── Middleware/             # Custom middleware (role checks, device validation)
│   │   └── Requests/               # Form request validation classes
│   ├── Models/
│   │   ├── User.php
│   │   ├── AttendanceSession.php
│   │   ├── AttendanceRecord.php
│   │   ├── Course.php
│   │   └── DeviceBinding.php
│   └── Services/                   # Business logic (GeofenceService, etc.)
│
├── config/
│   ├── cors.php                    # CORS config (allow mobile app origins)
│   └── sanctum.php                 # Sanctum token config
│
├── database/
│   ├── migrations/                 # Database migrations (one per table change)
│   └── seeders/                    # Database seeders for local testing
│
├── routes/
│   ├── api.php                     # All API routes (no web routes needed)
│   └── console.php                 # Artisan command routes
│
├── tests/
│   ├── Feature/                    # Feature tests (API endpoint tests)
│   └── Unit/                       # Unit tests (services, helpers)
│
├── .env                            # Local environment variables (never commit)
├── .env.example                    # Template for env variables (commit this)
└── composer.json
```

---

## Coding Standards

### Controllers

- Thin controllers — business logic belongs in **Service classes**
- One controller per resource
- Return consistent JSON responses
- Use **Form Request** classes for validation

```php
// ✅ Good — thin controller
class AttendanceController extends Controller
{
    public function checkIn(CheckInRequest $request, AttendanceSession $session): JsonResponse
    {
        $result = $this->geofenceService->verify(
            $session,
            $request->latitude,
            $request->longitude
        );

        if (! $result->withinBounds) {
            return response()->json(['status' => 'outside', 'message' => 'Not within required location'], 403);
        }

        $record = AttendanceRecord::create([
            'session_id' => $session->id,
            'student_id' => $request->user()->id,
            'checked_in_at' => now(),
        ]);

        return response()->json(['status' => 'recorded', 'record' => $record], 200);
    }
}
```

---

### API Responses

Always return JSON with a consistent structure:

```php
// Success
return response()->json([
    'message' => 'Action successful',
    'data'    => $resource,
], 200);

// Error
return response()->json([
    'message' => 'Human-readable error',
], 403);
```

Use appropriate HTTP status codes — see `docs/api-docs.md` for the full list.

---

### Models

- Use `$fillable` for mass assignment protection
- Define relationships explicitly
- Use casts for dates and enums

```php
class AttendanceSession extends Model
{
    protected $fillable = [
        'course_id', 'lecturer_id', 'latitude', 'longitude',
        'radius_meters', 'starts_at', 'ends_at',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at'   => 'datetime',
    ];

    public function records(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'session_id');
    }
}
```

---

### Migrations

- One migration per table creation or schema change
- Use descriptive migration names: `create_attendance_sessions_table`, `add_device_id_to_users_table`
- Never edit existing migrations — create new ones for changes

```bash
php artisan make:migration create_attendance_sessions_table
php artisan make:migration add_radius_to_attendance_sessions_table
```

---

### Routes

- All routes are in `routes/api.php`
- Group related routes with `Route::prefix()` and `Route::middleware()`
- Use `Route::apiResource()` for CRUD controllers

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('sessions', SessionController::class);
    Route::post('sessions/{session}/checkin', [AttendanceController::class, 'checkIn']);
    Route::post('devices/bind', [DeviceController::class, 'bind']);
});
```

---

### Authentication & Roles

- **Laravel Sanctum** is used for stateless token-based auth
- Roles: `student`, `lecturer`, `admin`
- Use middleware or policies to enforce role-based access

```php
// Example role middleware check
if ($request->user()->role !== 'lecturer') {
    return response()->json(['message' => 'Forbidden'], 403);
}
```

---

### Naming Conventions

| Item        | Convention                | Example                           |
| ----------- | ------------------------- | --------------------------------- |
| Controllers | PascalCase + `Controller` | `AttendanceController`            |
| Models      | PascalCase singular       | `AttendanceSession`               |
| Migrations  | snake_case with intent    | `create_attendance_records_table` |
| Routes      | kebab-case                | `/api/attendance-sessions`        |
| Columns     | snake_case                | `checked_in_at`, `radius_meters`  |
| Services    | PascalCase + `Service`    | `GeofenceService`                 |

---

## Running the Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

API runs at: `http://localhost:8000/api`
