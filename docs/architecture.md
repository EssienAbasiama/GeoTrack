# GeoTrack — System Architecture

> Last updated: 2026-03-15

---

## Overview

GeoTrack is a geo-fenced mobile attendance monitoring system for academic institutions. It verifies student identity and physical presence before recording attendance using GPS, device binding, and backend validation.

---

## Architecture Pattern

GeoTrack follows a **three-tier client-server architecture**:

```
┌─────────────────────────────────┐
│     Presentation Layer          │
│   React Native Mobile App       │
│   (Students & Lecturers)        │
└────────────┬────────────────────┘
             │ HTTPS / REST API
┌────────────▼────────────────────┐
│     Application Layer           │
│   Laravel REST API Backend      │
│   (Auth, Geofence, Attendance)  │
└────────────┬────────────────────┘
             │ SQL Queries
┌────────────▼────────────────────┐
│     Data Layer                  │
│   MySQL / PostgreSQL Database   │
│   (Users, Sessions, Records)    │
└─────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Presentation Layer — Mobile Application

- Built with **React Native + Expo**
- Styled using **NativeWind** (Tailwind CSS)
- Handles GPS location capture, user authentication UI, and attendance interactions
- Communicates with backend via authenticated REST API calls

**Key responsibilities:**

- User login/registration
- GPS coordinate capture
- Attendance check-in with geofence validation
- Presence verification prompts
- Session monitoring for lecturers

---

### 2. Application Layer — Laravel Backend

- Built with **Laravel 12 (PHP 8.5)**
- Exposes a **RESTful JSON API**
- Authentication via **Laravel Sanctum** (token-based, stateless)
- All routes prefixed under `/api`

**Key responsibilities:**

- User authentication and token management
- Role-based access control (Student / Lecturer / Admin)
- Geofence boundary validation against GPS coordinates
- Device binding validation
- Attendance session creation and management
- Attendance record processing and storage

---

### 3. Data Layer — Database

- **MySQL** (production) / SQLite (local development)
- Managed via Laravel Eloquent ORM and migrations

**Core tables:**

| Table                    | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `users`                  | Students, lecturers, and admins                         |
| `device_bindings`        | Maps a user to a registered device                      |
| `courses`                | Academic courses/modules                                |
| `attendance_sessions`    | Lecturer-created sessions with geofence and time window |
| `attendance_records`     | Student check-in records per session                    |
| `personal_access_tokens` | Sanctum API tokens                                      |

---

## Authentication Flow

```
Mobile App                        Laravel API
    │                                  │
    │── POST /api/auth/login ──────────▶│
    │                                  │ Validate credentials
    │                                  │ Generate Sanctum token
    │◀─ 200 { token, user } ───────────│
    │                                  │
    │── GET /api/user                  │
    │   Authorization: Bearer <token>  │
    │                                  │ Verify token via auth:sanctum
    │◀─ 200 { user data } ─────────────│
```

---

## Attendance Check-In Flow

```
Student Device                   Laravel API
    │                                │
    │── Capture GPS coordinates       │
    │── POST /api/sessions/{id}/checkin
    │   { latitude, longitude,        │
    │     device_id }                 │
    │                                │ 1. Verify Sanctum token
    │                                │ 2. Validate device binding
    │                                │ 3. Check session is active & within time window
    │                                │ 4. Calculate distance from geofence centre
    │                                │ 5. Accept or reject based on radius
    │◀─ 200 { status: "recorded" } ──│
    │   OR 403 { status: "outside" } │
```

---

## Technology Stack Summary

| Layer       | Technology                                          |
| ----------- | --------------------------------------------------- |
| Mobile App  | React Native, Expo SDK 55, TypeScript, NativeWind 4 |
| Backend API | Laravel 12, PHP 8.5, Sanctum                        |
| Database    | MySQL 8 (production), SQLite (development)          |
| Server      | Nginx / Apache on Ubuntu Linux                      |
| Transport   | HTTPS (TLS)                                         |
| GPS         | Expo Location / React Native Geolocation            |

---

## Diagrams

See `docs/diagrams/` for:

- `architecture.drawio` — editable system architecture diagram
- `flowchart.png` — attendance check-in flow
