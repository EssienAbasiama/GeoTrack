# GeoTrack — API Documentation

> Last updated: 2026-03-15  
> Base URL: `http://localhost:8000/api` (local) | `https://api.geotrack.app/api` (production)  
> Auth: Bearer Token (Laravel Sanctum)

---

## Authentication

All protected routes require the following header:

```
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

---

## Endpoints

### Auth

---

#### `POST /api/auth/register`

Register a new user account.

**Request body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password",
  "password_confirmation": "password",
  "role": "student"
}
```

**Response `201`:**

```json
{
  "message": "Registration successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  },
  "token": "1|abc123..."
}
```

---

#### `POST /api/auth/login`

Authenticate and receive a Sanctum token.

**Request body:**

```json
{
  "email": "john@example.com",
  "password": "password"
}
```

**Response `200`:**

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  },
  "token": "1|abc123..."
}
```

**Response `401`:**

```json
{
  "message": "Invalid credentials"
}
```

---

#### `POST /api/auth/logout` 🔒

Revoke the current access token.

**Response `200`:**

```json
{
  "message": "Logged out successfully"
}
```

---

#### `GET /api/user` 🔒

Return the authenticated user's profile.

**Response `200`:**

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "student"
}
```

---

### Attendance Sessions

---

#### `GET /api/sessions` 🔒

List all active attendance sessions.

**Response `200`:**

```json
{
  "data": [
    {
      "id": 1,
      "course": "EEG 501",
      "lecturer": "Dr. Smith",
      "latitude": 7.2986,
      "longitude": 3.3476,
      "radius_meters": 100,
      "starts_at": "2026-03-15T08:00:00Z",
      "ends_at": "2026-03-15T10:00:00Z",
      "is_active": true
    }
  ]
}
```

---

#### `POST /api/sessions` 🔒 _(Lecturer only)_

Create a new attendance session.

**Request body:**

```json
{
  "course_id": 1,
  "latitude": 7.2986,
  "longitude": 3.3476,
  "radius_meters": 100,
  "starts_at": "2026-03-15T08:00:00Z",
  "ends_at": "2026-03-15T10:00:00Z"
}
```

**Response `201`:**

```json
{
  "message": "Session created",
  "session": { ... }
}
```

---

#### `POST /api/sessions/{id}/checkin` 🔒 _(Student only)_

Mark attendance for a session. Requires GPS coordinates and device ID.

**Request body:**

```json
{
  "latitude": 7.2987,
  "longitude": 3.3478,
  "device_id": "device-uuid-here"
}
```

**Response `200` — Attendance recorded:**

```json
{
  "status": "recorded",
  "message": "Attendance marked successfully",
  "record": {
    "id": 42,
    "session_id": 1,
    "student_id": 5,
    "checked_in_at": "2026-03-15T08:12:00Z"
  }
}
```

**Response `403` — Outside geofence:**

```json
{
  "status": "outside",
  "message": "You are not within the required location"
}
```

**Response `409` — Already checked in:**

```json
{
  "status": "duplicate",
  "message": "Attendance already recorded for this session"
}
```

---

#### `GET /api/sessions/{id}/records` 🔒 _(Lecturer only)_

Get all attendance records for a session.

**Response `200`:**

```json
{
  "data": [
    {
      "student_id": 5,
      "name": "Jane Doe",
      "checked_in_at": "2026-03-15T08:12:00Z",
      "status": "present"
    }
  ]
}
```

---

### Device Binding

---

#### `POST /api/devices/bind` 🔒

Bind a device to the authenticated user's account.

**Request body:**

```json
{
  "device_id": "device-uuid-here",
  "device_name": "iPhone 15"
}
```

**Response `200`:**

```json
{
  "message": "Device bound successfully"
}
```

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "message": "Human-readable error description",
  "errors": {
    "field": ["Validation error detail"]
  }
}
```

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `200`  | OK                                                         |
| `201`  | Created                                                    |
| `401`  | Unauthenticated — missing or invalid token                 |
| `403`  | Forbidden — insufficient permissions or geofence rejection |
| `404`  | Resource not found                                         |
| `409`  | Conflict — duplicate action                                |
| `422`  | Validation error                                           |
| `500`  | Internal server error                                      |

---

> 🔒 = Requires `Authorization: Bearer <token>` header
