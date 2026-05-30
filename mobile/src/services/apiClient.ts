import axios, { type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { createNavigationContainerRef } from '@react-navigation/native';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearAuthStorage, getDeviceUid } from '../utils/secureStorage';
import type { RootStackParamList } from '../types/navigation';
import type {
    ApiDevice,
    DeviceFingerprint,
    ApiCourse,
    ApiCourseStudent,
    ApiGeofence,
    ApiSession,
    ApiAttendanceRecord,
    ApiPresenceCheck,
    ApiFaceProfile,
    ApiStudentDashboard,
    ApiLecturerDashboard,
    ApiAdminDashboard,
    ApiLecturer,
    ApiPushTokenResponse,
} from '../types/api';

// ─── Navigation ref (register in App.tsx: <NavigationContainer ref={navigationRef}>) ───
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Base URL ────────────────────────────────────────────────────────────────
// Strategy:
//   1. Honour EXPO_PUBLIC_API_BASE_URL if the developer set one — final override.
//   2. In production builds, use the configured hosted API.
//   3. Otherwise, pick a dev URL based on where the app is running:
//        - Physical phone (Expo Go / dev client) → use Metro bundler's host IP,
//          because that IP is, by definition, reachable from the device.
//        - Android emulator → 10.0.2.2 (its loopback to the host machine).
//        - iOS simulator → localhost (shares the host network stack).
//
// Make sure the Laravel backend is started with `--host=0.0.0.0` so it accepts
// requests on the LAN interface (not only on 127.0.0.1).

const DEV_PORT = 8000;
const PROD_BASE_URL = 'https://api.geotrack.edu/api';

function resolveDevHost(): string {
    // Expo SDK 49+ exposes hostUri on expoConfig; older runtimes used
    // manifest.debuggerHost. Both look like "192.168.1.42:8081".
    const expoHostUri: string | undefined =
        (Constants.expoConfig as any)?.hostUri ??
        (Constants as any).manifest?.debuggerHost ??
        (Constants as any).manifest2?.extra?.expoClient?.hostUri;

    if (expoHostUri) {
        const host = expoHostUri.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return host;
        }
    }

    // Fallbacks for emulator / simulator runs where there's no LAN bundler host.
    if (Platform.OS === 'android') return '10.0.2.2';
    return 'localhost';
}

function resolveBaseUrl(): string {
    // Manual override wins. Set this in an .env file or app.json `extra` if the
    // auto-detection misses (uncommon LAN setups, captive Wi-Fi, ngrok, etc.).
    const override =
        (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
        ((Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined);
    if (override) return override.replace(/\/$/, '');

    if (!__DEV__) return PROD_BASE_URL;

    // Physical device on Expo Go / dev client → always use the Metro host IP.
    // Device.isDevice is true on real hardware, false on simulator/emulator.
    if (Device.isDevice) {
        const host = resolveDevHost();
        return `http://${host}:${DEV_PORT}/api`;
    }

    // Emulator / simulator paths
    if (Platform.OS === 'android') return `http://10.0.2.2:${DEV_PORT}/api`;
    return `http://localhost:${DEV_PORT}/api`;
}

export const BASE_URL = resolveBaseUrl();

if (__DEV__) {
    // Helpful one-line trace so it's obvious in Metro which host the app picked.
    console.log(`[GeoTrack] API base URL: ${BASE_URL}`);
}

// ─── Custom config fields augment ────────────────────────────────────────────
declare module 'axios' {
    interface InternalAxiosRequestConfig {
        _retryCount?: number;
        _requestId?: string;
        _requestOwner?: string | null;
        _networkRetry?: boolean;
        _skipRefresh?: boolean;
    }
}

// ─── Request cancellation helpers ────────────────────────────────────────────
type CancellableController = { abort: () => void } | { cancel: (reason?: string) => void };
const controllerRegistry = new Map<string, Map<string, CancellableController>>();

const registerController = (owner: string | null, id: string, ctrl: CancellableController) => {
    if (!owner || !id) return;
    if (!controllerRegistry.has(owner)) controllerRegistry.set(owner, new Map());
    controllerRegistry.get(owner)!.set(id, ctrl);
};

const unregisterController = (owner: string | null | undefined, id: string | undefined) => {
    if (!owner || !id) return;
    const m = controllerRegistry.get(owner);
    if (!m) return;
    m.delete(id);
    if (m.size === 0) controllerRegistry.delete(owner);
};

/** Cancel all in-flight requests belonging to an owner (e.g. a screen unmounting) */
export const cancelByOwner = (owner: string) => {
    const m = controllerRegistry.get(owner);
    if (!m) return;
    for (const ctrl of m.values()) {
        try {
            if ('abort' in ctrl) ctrl.abort();
            else ctrl.cancel(`Cancelled by owner: ${owner}`);
        } catch { /* ignore */ }
    }
    controllerRegistry.delete(owner);
};

/** Cancel every in-flight request across all owners */
export const cancelAll = () => {
    for (const owner of Array.from(controllerRegistry.keys())) cancelByOwner(owner);
};

// ─── Retry / rate-limit config ───────────────────────────────────────────────
const RETRY = {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1_000,
    MAX_DELAY_MS: 32_000,
    BACKOFF_MULTIPLIER: 2,
    JITTER_FACTOR: 0.1,
} as const;

const backoff = (attempt: number, retryAfterHeader?: string | null): number => {
    if (retryAfterHeader) return parseInt(retryAfterHeader, 10) * 1_000;
    const exp = Math.min(
        RETRY.INITIAL_DELAY_MS * RETRY.BACKOFF_MULTIPLIER ** (attempt - 1),
        RETRY.MAX_DELAY_MS,
    );
    return Math.max(0, exp + exp * RETRY.JITTER_FACTOR * (Math.random() * 2 - 1));
};

// ─── Token refresh queue ─────────────────────────────────────────────────────
// Prevents thundering herd when multiple requests 401 simultaneously.
let isRefreshing = false;
let refreshQueue: ((newToken: string | null) => void)[] = [];

const enqueueRefresh = (cb: (t: string | null) => void) => refreshQueue.push(cb);
const drainRefreshQueue = (token: string | null) => {
    refreshQueue.forEach(cb => cb(token));
    refreshQueue = [];
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 15_000,
});

// ─── Request interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Bound-device header — required by the backend's `bound.device` middleware
    // for student-restricted routes. Sent on every request once a device UID exists.
    const deviceUid = await getDeviceUid();
    if (deviceUid) config.headers['X-Device-UID'] = deviceUid;

    config._retryCount ??= 0;
    config._requestId ??= Math.random().toString(36).slice(2, 11);
    config._requestOwner ??= null;

    // Attach AbortController for cancellation
    try {
        const ctrl = new AbortController();
        config.signal = ctrl.signal;
        registerController(config._requestOwner, config._requestId, ctrl);
    } catch {
        // AbortController not available (very old RN) - silently skip
    }

    return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────
apiClient.interceptors.response.use(
    response => {
        const cfg = response.config as InternalAxiosRequestConfig;
        unregisterController(cfg._requestOwner, cfg._requestId);
        return response;
    },
    async (error: unknown) => {
        const axiosError = axios.isAxiosError(error) ? error : null;
        const config = (axiosError?.config ?? {}) as InternalAxiosRequestConfig;
        const status = axiosError?.response?.status;
        const retryAfterHeader = axiosError?.response?.headers?.['retry-after'] as string | undefined;

        unregisterController(config._requestOwner, config._requestId);

        // ── Cancellation ────────────────────────────────────────────────────
        const wasCancelled =
            (axios.isCancel && axios.isCancel(error)) ||
            (axiosError?.code === 'ERR_CANCELED') ||
            (axiosError?.name === 'CanceledError');

        if (wasCancelled) return Promise.reject(error);

        // ── 429 Too Many Requests – exponential backoff retry ───────────────
        if (status === 429) {
            config._retryCount = (config._retryCount ?? 0) + 1;

            if (config._retryCount > RETRY.MAX_RETRIES) {
                console.warn(`[${config._requestId}] 429 max retries exceeded`);
                return Promise.reject(error);
            }

            const delay = backoff(config._retryCount, retryAfterHeader);
            console.log(`[${config._requestId}] 429 – retrying in ${Math.round(delay)}ms (attempt ${config._retryCount}/${RETRY.MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, delay));
            return apiClient(config);
        }

        // ── 401 Unauthorized – attempt silent token refresh ─────────────────
        const isAuthEndpoint = config.url?.includes('/auth/login') ||
            config.url?.includes('/auth/register') ||
            config.url?.includes('/auth/refresh');

        if (status === 401 && !isAuthEndpoint && !config._skipRefresh) {
            if (isRefreshing) {
                // Queue this request; retry once the refresh resolves
                return new Promise((resolve, reject) => {
                    enqueueRefresh(newToken => {
                        if (!newToken) { reject(error); return; }
                        config.headers.Authorization = `Bearer ${newToken}`;
                        config._skipRefresh = true;
                        resolve(apiClient(config));
                    });
                });
            }

            isRefreshing = true;

            try {
                const storedRefresh = await getRefreshToken();
                if (!storedRefresh) throw new Error('No refresh token stored');

                const { data } = await apiClient.post(
                    '/auth/refresh',
                    { refresh_token: storedRefresh },
                    { _skipRefresh: true } as InternalAxiosRequestConfig,
                );

                const { access_token, refresh_token } = data.tokens as { access_token: string; refresh_token: string };
                await setAccessToken(access_token);
                await setRefreshToken(refresh_token);

                drainRefreshQueue(access_token);

                config.headers.Authorization = `Bearer ${access_token}`;
                config._skipRefresh = true;
                return apiClient(config);
            } catch (refreshErr) {
                drainRefreshQueue(null);
                await clearAuthStorage();

                if (navigationRef.isReady()) {
                    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
                }

                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }

        // ── Network error – single retry ────────────────────────────────────
        if (!status && !config._networkRetry) {
            config._networkRetry = true;
            console.warn(`[${config._requestId}] Network error – retrying once`);
            await new Promise(r => setTimeout(r, RETRY.INITIAL_DELAY_MS));
            return apiClient(config);
        }

        // ── All other errors – let caller handle ────────────────────────────
        const message =
            axiosError?.response?.data?.message ??
            axiosError?.response?.data?.error ??
            axiosError?.message ??
            'Something went wrong';

        console.error(`[${config._requestId}] ${status ?? 'Network'} error:`, message);

        return Promise.reject(error);
    },
);

/**
 * Scope a client to a specific owner (screen/component).
 * All requests from this client can be batch-cancelled via cancelByOwner(owner).
 *
 * @example
 * const api = scopedApiClient('HomeScreen');
 * const { data } = await api.get('/courses');
 * // On screen unmount: cancelByOwner('HomeScreen');
 */
export const scopedApiClient = (owner: string) => ({
    get: <T = unknown>(url: string, cfg?: InternalAxiosRequestConfig) =>
        apiClient.get<T>(url, { ...cfg, _requestOwner: owner } as InternalAxiosRequestConfig),
    post: <T = unknown>(url: string, data?: unknown, cfg?: InternalAxiosRequestConfig) =>
        apiClient.post<T>(url, data, { ...cfg, _requestOwner: owner } as InternalAxiosRequestConfig),
    put: <T = unknown>(url: string, data?: unknown, cfg?: InternalAxiosRequestConfig) =>
        apiClient.put<T>(url, data, { ...cfg, _requestOwner: owner } as InternalAxiosRequestConfig),
    patch: <T = unknown>(url: string, data?: unknown, cfg?: InternalAxiosRequestConfig) =>
        apiClient.patch<T>(url, data, { ...cfg, _requestOwner: owner } as InternalAxiosRequestConfig),
    delete: <T = unknown>(url: string, cfg?: InternalAxiosRequestConfig) =>
        apiClient.delete<T>(url, { ...cfg, _requestOwner: owner } as InternalAxiosRequestConfig),
});

// ─── Typed API response helpers ───────────────────────────────────────────────
export interface ApiUser {
    id: number;
    name: string;
    email: string;
    role: 'student' | 'lecturer';
    matric_no?: string | null;
    email_verified_at?: string | null;
    created_at: string;
}

export interface ApiTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    access_token_expires_at: string;
    refresh_token_expires_at: string;
}

export interface AuthResponse {
    message: string;
    tokens: ApiTokens;
    user: ApiUser;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
    register: (body: {
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        role: 'student' | 'lecturer';
        matric_no?: string;
    }) => apiClient.post<{ message: string; email: string }>('/auth/register', body),

    verifyEmailCode: (body: { email: string; code: string }) =>
        apiClient.post<AuthResponse>('/auth/verify-email-code', body),

    resendEmailCode: (body: { email: string }) =>
        apiClient.post<{ message: string }>('/auth/resend-email-code', body),

    login: (body: { email: string; password: string }) =>
        apiClient.post<AuthResponse>('/auth/login', body),

    refresh: (body: { refresh_token: string }) =>
        apiClient.post<AuthResponse>('/auth/refresh', body),

    me: () => apiClient.get<{ user: ApiUser }>('/auth/me'),

    logout: (body?: { refresh_token?: string }) =>
        apiClient.post<{ message: string }>('/auth/logout', body ?? {}),

    forgotPassword: (body: { email: string }) =>
        apiClient.post<{ message: string }>('/auth/forgot-password', body),

    resetPassword: (body: {
        email: string;
        code: string;
        password: string;
        password_confirmation: string;
    }) => apiClient.post<{ message: string }>('/auth/reset-password', body),
};

// ─── Envelope unwrapper ──────────────────────────────────────────────────────
// Backend wraps successful payloads as `{message, data: {...}}`. The mobile
// screens destructure `const { data } = await xApi.method()` and access
// `data.courses` (etc) — i.e. they expect the inner envelope's body, not the
// outer envelope. Each typed wrapper pipes its result through `unwrap` so the
// caller sees the inner `data` shape directly.
import type { AxiosResponse } from 'axios';
const unwrap = <T>(p: Promise<AxiosResponse<{ data: T; message?: string }>>): Promise<AxiosResponse<T>> =>
    p.then((r) => ({ ...r, data: r.data.data }));

// ─── Device API ──────────────────────────────────────────────────────────────
export const deviceApi = {
    bind: (body: DeviceFingerprint & { push_token?: string }) =>
        unwrap<{ device: ApiDevice }>(
            apiClient.post('/devices/bind', body),
        ),

    me: () => unwrap<{ devices: ApiDevice[] }>(apiClient.get('/devices/me')),

    reset: () => apiClient.post<{ message: string; data?: { revoked: number } }>('/devices/reset', {}),

    setPushToken: (deviceId: number | string, token: string) =>
        unwrap<{ device: ApiDevice }>(
            apiClient.post(`/devices/${deviceId}/push-token`, { push_token: token }),
        ),
};

// ─── Course API ──────────────────────────────────────────────────────────────
export const courseApi = {
    list: () => unwrap<{ courses: ApiCourse[] }>(apiClient.get('/courses')),

    create: (body: {
        code: string;
        title: string;
        description?: string;
        department: string;
        level?: string;
        lecturer_id?: number;
    }) => unwrap<{ course: ApiCourse }>(apiClient.post('/courses', body)),

    get: (id: number | string) =>
        unwrap<{ course: ApiCourse }>(apiClient.get(`/courses/${id}`)),

    update: (id: number | string, body: Partial<ApiCourse>) =>
        unwrap<{ course: ApiCourse }>(apiClient.patch(`/courses/${id}`, body)),

    delete: (id: number | string) =>
        apiClient.delete<{ message: string }>(`/courses/${id}`),

    enroll: (
        courseId: number | string,
        body: { user_id?: number; matric_no?: string },
    ) => apiClient.post<{ message: string }>(`/courses/${courseId}/enroll`, body),

    selfEnroll: (courseId: number | string) =>
        apiClient.post<{ message: string }>(`/courses/${courseId}/self-enroll`, {}),

    unenroll: (courseId: number | string, userId: number | string) =>
        apiClient.delete<{ message: string }>(`/courses/${courseId}/enroll/${userId}`),

    students: (courseId: number | string) =>
        unwrap<{ students: ApiCourseStudent[]; total_sessions?: number }>(
            apiClient.get(`/courses/${courseId}/students`),
        ),
};

// ─── Geofence API ────────────────────────────────────────────────────────────
export const geofenceApi = {
    get: (courseId: number | string) =>
        unwrap<{ geofence: ApiGeofence | null }>(
            apiClient.get(`/courses/${courseId}/geofence`),
        ),

    upsert: (
        courseId: number | string,
        body: {
            shape: 'circle' | 'polygon';
            center_lat?: number;
            center_lng?: number;
            radius_m?: number;
            polygon?: Array<{ latitude: number; longitude: number }>;
            label?: string;
        },
    ) =>
        unwrap<{ geofence: ApiGeofence }>(
            apiClient.put(`/courses/${courseId}/geofence`, body),
        ),
};

// ─── Session API ─────────────────────────────────────────────────────────────
export const sessionApi = {
    start: (
        courseId: number | string,
        body: {
            mode?: 'tap' | 'face_recognition';
            duration_minutes?: number;
            presence_checks_enabled?: boolean;
            presence_check_interval_minutes?: number;
            late_after_minutes?: number;
        } = {},
    ) =>
        unwrap<{ session: ApiSession }>(
            apiClient.post(`/courses/${courseId}/sessions`, body),
        ),

    list: (courseId: number | string) =>
        unwrap<{ sessions: ApiSession[] }>(apiClient.get(`/courses/${courseId}/sessions`)),

    active: (courseId: number | string) =>
        unwrap<{ session: ApiSession | null }>(
            apiClient.get(`/courses/${courseId}/sessions/active`),
        ),

    get: (id: number | string) =>
        unwrap<{ session: ApiSession }>(apiClient.get(`/sessions/${id}`)),

    close: (id: number | string) =>
        unwrap<{ session: ApiSession }>(apiClient.post(`/sessions/${id}/close`, {})),

    records: (id: number | string) =>
        unwrap<{ records: ApiAttendanceRecord[] }>(apiClient.get(`/sessions/${id}/records`)),

    manualPresenceCheck: (id: number | string) =>
        unwrap<{ presence_check: ApiPresenceCheck }>(
            apiClient.post(`/sessions/${id}/presence-check`, {}),
        ),
};

// ─── Attendance API ──────────────────────────────────────────────────────────
export const attendanceApi = {
    checkIn: (
        sessionId: number | string,
        body: {
            latitude: number;
            longitude: number;
            accuracy?: number;
            face_image_base64?: string;
        },
    ) =>
        unwrap<{ record: ApiAttendanceRecord }>(
            apiClient.post(`/sessions/${sessionId}/checkin`, body),
        ),

    myRecord: (sessionId: number | string) =>
        unwrap<{ record: ApiAttendanceRecord | null }>(
            apiClient.get(`/sessions/${sessionId}/my-record`),
        ),

    myHistory: () =>
        unwrap<{ records: ApiAttendanceRecord[] }>(apiClient.get('/me/attendance')),
};

// ─── Presence-check API ──────────────────────────────────────────────────────
export const presenceApi = {
    pending: () =>
        unwrap<{ responses: ApiPresenceCheck[] }>(apiClient.get('/presence-checks/pending')),

    respond: (
        checkId: number | string,
        body: {
            latitude: number;
            longitude: number;
            accuracy?: number;
            face_image_base64?: string;
        },
    ) => apiClient.post<{ message: string }>(`/presence-checks/${checkId}/respond`, body),
};

// ─── Face-profile API ────────────────────────────────────────────────────────
export const faceApi = {
    enroll: (base64: string) =>
        unwrap<{ profile: ApiFaceProfile }>(
            apiClient.post('/face-profile', { face_image_base64: base64 }),
        ),

    status: () => unwrap<{ profile: ApiFaceProfile }>(apiClient.get('/face-profile')),

    clear: () => apiClient.delete<{ message: string }>('/face-profile'),
};

// ─── Dashboard API ───────────────────────────────────────────────────────────
export const dashboardApi = {
    student: () => unwrap<ApiStudentDashboard>(apiClient.get('/dashboard/student')),
    lecturer: () => unwrap<ApiLecturerDashboard>(apiClient.get('/dashboard/lecturer')),
    admin: () => unwrap<ApiAdminDashboard>(apiClient.get('/dashboard/admin')),
};

// ─── Lecturer API (admin) ────────────────────────────────────────────────────
export const lecturerApi = {
    list: () => unwrap<{ lecturers: ApiLecturer[] }>(apiClient.get('/lecturers')),

    assignCourse: (lecturerId: number | string, courseId: number | string) =>
        apiClient.post<{ message: string }>(`/lecturers/${lecturerId}/assign-course`, {
            course_id: courseId,
        }),
};

// ─── Push-token API ──────────────────────────────────────────────────────────
export const pushTokenApi = {
    register: (body: { token: string; device_uid: string; platform: string }) =>
        apiClient.post<ApiPushTokenResponse>('/push-tokens', body),
};

export default apiClient;
