import axios, { type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearAuthStorage } from '../utils/secureStorage';
import type { RootStackParamList } from '../types/navigation';

// ─── Navigation ref (register in App.tsx: <NavigationContainer ref={navigationRef}>) ───
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Base URL (update for production deployment) ─────────────────────────────
const DEV_BASE_URL =
    Platform.OS === 'android'
        ? 'http://10.0.2.2:8000/api'  // Android emulator → host machine
        : 'http://localhost:8000/api'; // iOS simulator / web

export const BASE_URL = __DEV__ ? DEV_BASE_URL : 'https://api.geotrack.edu/api';

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

export default apiClient;
