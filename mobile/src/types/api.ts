/**
 * GeoTrack API response shapes
 *
 * These mirror the Laravel backend's JSON contract. Keep them strict but
 * tolerate optional/nullable fields the backend may add over time.
 */

export type ApiRole = 'student' | 'lecturer' | 'hoc' | 'superadmin';

// ─── Institution ──────────────────────────────────────────────────────────────
export interface ApiInstitution {
    id: number;
    name: string;
    code: string;
    address?: string | null;
    logo_url?: string | null;
    created_at?: string;
    updated_at?: string;
}

// ─── Class invite / share link ────────────────────────────────────────────────
export interface ApiClassInvite {
    token: string;
    role: 'student' | 'lecturer';
    expires_at?: string | null;
    course?: {
        id: number;
        code: string;
        title: string;
        department?: string | null;
        venue?: string | null;
        lecturer_name?: string | null;
        institution?: { id: number; name: string; code: string } | null;
    } | null;
}

// ─── Device ──────────────────────────────────────────────────────────────────
export interface ApiDevice {
    id: number;
    device_uid: string;
    platform: 'ios' | 'android' | 'web' | string;
    brand?: string | null;
    model?: string | null;
    os_name?: string | null;
    os_version?: string | null;
    app_version?: string | null;
    push_token?: string | null;
    last_seen_at?: string | null;
    created_at?: string;
}

export interface DeviceFingerprint {
    device_uid: string;
    platform: 'ios' | 'android' | 'web' | string;
    brand?: string | null;
    model?: string | null;
    os_name?: string | null;
    os_version?: string | null;
    app_version?: string | null;
}

// ─── Course / Class ──────────────────────────────────────────────────────────
export interface ApiCourse {
    id: number;
    code: string;
    title: string;
    description?: string | null;
    department?: string;
    level?: string | null;
    institution_id?: number | null;
    institution?: Pick<ApiInstitution, 'id' | 'name' | 'code'> | null;
    lecturer_id?: number | null;
    lecturer?: { id: number; name: string; email: string } | null;
    geofence?: ApiGeofence | null;
    enrollments_count?: number;
    sessions_count?: number;
    created_at?: string;
    /** Convenience aliases derived from the backend payload (not always present). */
    name?: string;
    venue?: string | null;
    day?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    lecturer_name?: string | null;
    total_students?: number;
    attendance_rate?: number | null;
}

export interface ApiCourseStudent {
    id: number;
    name: string;
    email: string;
    matric_no?: string | null;
    avatar_url?: string | null;
    attendance_rate?: number | null;
}

/** Result row from GET /students/search (lecturer enrolling a student). */
export interface ApiStudentSearchResult {
    id: number;
    name: string;
    email: string;
    matric_no?: string | null;
}

// ─── Student attendance (per-course history) ───────────────────────────────────
export interface ApiStudentAttendanceRow {
    id: string;
    date: string | null;
    day: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    duration_minutes: number;
    expected_minutes: number;
    status: 'present' | 'late' | 'absent' | 'excused';
    was_on_time: boolean;
    location_verified: boolean;
    face_verified: boolean;
    /** Times the student clocked out and came back during the class. */
    re_entries: number;
    /** Clocked in and hasn't clocked out yet. */
    still_in_class: boolean;
    events: ApiAttendanceEvent[];
}

/** One entry or exit inside a class. */
export interface ApiAttendanceEvent {
    type: 'check_in' | 're_entry' | 'check_out';
    label: string;
    time?: string | null;
    occurred_at?: string | null;
    within_geofence: boolean;
}

export interface ApiStudentAttendance {
    student: { id: number; name: string; email: string; matric_no?: string | null };
    summary: {
        total_sessions: number;
        present: number;
        late: number;
        absent: number;
        excused: number;
        attendance_rate: number;
    };
    sessions: ApiStudentAttendanceRow[];
}

// ─── Geofence ────────────────────────────────────────────────────────────────
export type GeofenceShape = 'circle' | 'polygon';

export interface ApiGeofence {
    id?: number;
    course_id: number;
    shape: GeofenceShape;
    center_lat?: number | null;
    center_lng?: number | null;
    radius_m?: number | null;
    polygon?: Array<{ latitude: number; longitude: number }> | null;
    name?: string | null;
    updated_at?: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────
export type SessionMode = 'tap' | 'face_recognition';
export type SessionStatus = 'scheduled' | 'active' | 'closed';

export interface ApiSession {
    id: number;
    course_id: number;
    mode: SessionMode;
    status: SessionStatus;
    starts_at: string;
    ends_at: string;
    closed_at?: string | null;
    opened_by?: number | null;
    presence_checks_enabled?: boolean;
    presence_check_interval_minutes?: number;
    late_after_minutes?: number;
    notes?: string | null;
    course?: ApiCourse;
}

export interface ApiAttendanceRecord {
    id: number;
    session_id: number;
    user_id: number;
    student?: {
        id: number;
        name: string;
        matric_no?: string | null;
        email?: string | null;
        avatar_url?: string | null;
    };
    checked_in_at: string;
    checked_out_at?: string | null;
    re_entry_count?: number;
    minutes_present?: number;
    still_in_class?: boolean;
    events?: ApiAttendanceEvent[];
    latitude?: number | null;
    longitude?: number | null;
    accuracy_m?: number | null;
    distance_m?: number | null;
    status?: 'present' | 'late' | 'absent' | 'excused';
    face_match_score?: number | null;
}

// ─── Presence checks ─────────────────────────────────────────────────────────
export interface ApiPresenceCheck {
    id: number;
    session_id: number;
    course_id: number;
    course_code?: string;
    course_name?: string;
    issued_at: string;
    expires_at: string;
    responded_at?: string | null;
    status: 'pending' | 'completed' | 'expired' | 'failed';
}

// ─── Face profile ────────────────────────────────────────────────────────────
// The backend returns the FaceProfile model record directly. A non-null profile
// means enrolled; null means not enrolled. There is no `enrolled` boolean field.
export interface ApiFaceProfile {
    id: number;
    user_id: number;
    provider?: string | null;
    enrolled_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

// ─── Dashboards ──────────────────────────────────────────────────────────────
export interface ApiStudentDashboard {
    totals: {
        courses: number;
        sessions: number;
        attended: number;
        attendance_rate: number;
    };
    recent_attendance: ApiAttendanceRecord[];
    upcoming_classes: ApiCourse[];
    active_sessions?: ApiSession[];
}

export interface ApiLecturerDashboard {
    courses: ApiCourse[];
    active_sessions: ApiSession[];
    today_counts: {
        present: number;
        late: number;
        flagged: number;
        absent: number;
    };
}

export interface ApiAdminDashboard {
    counts: {
        students: number;
        lecturers: number;
        admins: number;
        courses: number;
        active_sessions: number;
        total_sessions: number;
        total_records: number;
    };
}

// ─── Lecturer ────────────────────────────────────────────────────────────────
export interface ApiLecturer {
    id: number;
    name: string;
    email: string;
    department?: string | null;
    avatar_url?: string | null;
    assigned_courses?: ApiCourse[];
    total_students?: number;
}

// ─── Push token ──────────────────────────────────────────────────────────────
export interface ApiPushTokenResponse {
    ok: boolean;
}
