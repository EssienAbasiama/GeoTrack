import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import axios from 'axios';
import { useRole, type UserRole } from './RoleContext';
import { authApi, navigationRef, type ApiUser } from '../services/apiClient';
import {
    clearAuthStorage,
    getAccessToken,
    getDeviceUid,
    getRefreshToken,
    getUserData,
    removeStoredPushToken,
    setAccessToken,
    setRefreshToken,
    setUserData,
} from '../utils/secureStorage';
import { bindDevice, type BindDeviceResult } from '../services/deviceBinding';

type RegisterRole = 'student' | 'lecturer';

export interface InviteMeta {
    token?: string;
    department?: string;
    classCode?: string;
    roleHint?: RegisterRole;
}

interface PendingRegistration {
    name: string;
    email: string;
    password: string;
    role: RegisterRole;
    matricNo?: string;
    invite?: InviteMeta;
}

interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: RegisterRole;
    matricNo?: string;
    invite?: InviteMeta;
}

export type BindStatus = 'idle' | 'pending' | 'bound' | 'conflict';

interface AuthContextType {
    isAuthenticated: boolean;
    user: AuthUser | null;
    authLoading: boolean;
    /** True only while the initial token-restore check runs on app launch. */
    isInitialising: boolean;
    pendingRegistration: PendingRegistration | null;
    pendingEmail: string | null;
    bindStatus: BindStatus;
    signIn: (email: string, password: string) => Promise<{ ok: boolean; unverified?: boolean; message?: string }>;
    signOut: () => Promise<void>;
    startRegistration: (data: PendingRegistration) => Promise<{ ok: boolean; message?: string }>;
    verifyRegistrationEmail: (code: string) => Promise<{ ok: boolean; message?: string }>;
    resendVerificationCode: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string }>;
    resetPassword: (code: string, nextPassword: string, email?: string) => Promise<{ ok: boolean; message?: string }>;
    /** Force re-bind; used by the DeviceConflict reset flow. */
    rebindDevice: () => Promise<BindDeviceResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const apiUserToAuthUser = (u: ApiUser, invite?: InviteMeta): AuthUser => ({
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role as RegisterRole,
    matricNo: u.matric_no ?? undefined,
    invite,
});

/** Extract a human-readable error message from any thrown value. */
const extractError = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
    if (axios.isAxiosError(err)) {
        // Server responded with an error body
        if (err.response) {
            return (
                err.response.data?.message ||
                err.response.data?.error ||
                fallback
            );
        }
        // No response — network unreachable or timeout
        const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '');
        if (isTimeout) {
            return 'Request timed out. Check that the server is running and your device is on the same network.';
        }
        return 'Could not reach the server. Check your internet connection and try again.';
    }
    if (err instanceof Error) return err.message;
    return fallback;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: AuthProviderProps) {
    const { setRole } = useRole();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [isInitialising, setIsInitialising] = useState(true);
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(null);
    const [bindStatus, setBindStatus] = useState<BindStatus>('idle');

    // ── Device binding helper ────────────────────────────────────────────────
    const handleBind = async (): Promise<BindDeviceResult> => {
        setBindStatus('pending');
        const result = await bindDevice();
        if (result.ok) {
            setBindStatus('bound');
        } else if ('conflict' in result && result.conflict) {
            setBindStatus('conflict');
        } else {
            // Network / non-conflict error: keep status idle so we retry later
            setBindStatus('idle');
        }
        return result;
    };

    const rebindDevice = async () => handleBind();

    /** Navigate to DeviceConflict and cleanly clear auth state. */
    const handleBindConflict = async (message?: string) => {
        await clearAuthStorage();
        setUser(null);
        if (navigationRef.isReady()) {
            navigationRef.reset({
                index: 0,
                routes: [{ name: 'DeviceConflict', params: { message } }],
            });
        }
    };

    // ── Restore session on app launch ─────────────────────────────────────────
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const token = await getAccessToken();
                if (!token) return;

                // Restore user from the cached data stored at last login.
                // We intentionally don't call /me here: it keeps startup instant
                // and avoids blocking on a slow network, The token refresh interceptor
                // in apiClient will silently renew expired tokens on the first API call.
                const cached = await getUserData();
                if (cached) {
                    const parsed = (typeof cached === 'string'
                        ? (JSON.parse(cached) as ApiUser)
                        : (cached as unknown as ApiUser));
                    const restored = apiUserToAuthUser(parsed);
                    setUser(restored);
                    setRole(restored.role as UserRole);

                    // Silent best-effort re-bind in the background. Only acts on 409.
                    const deviceUid = await getDeviceUid();
                    if (deviceUid) {
                        handleBind().then((result) => {
                            if (!result.ok && 'conflict' in result && result.conflict) {
                                handleBindConflict(result.message);
                            }
                        }).catch(() => { /* ignore */ });
                    }
                }
            } catch {
                // Corrupt cache – clear and stay logged out
                await clearAuthStorage();
            } finally {
                setIsInitialising(false);
            }
        };

        restoreSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sign in ───────────────────────────────────────────────────────────────
    const signIn = async (email: string, password: string) => {
        setAuthLoading(true);
        try {
            const { data } = await authApi.login({ email: email.trim(), password });
            await setAccessToken(data.tokens.access_token);
            await setRefreshToken(data.tokens.refresh_token);
            await setUserData(data.user);

            const nextUser = apiUserToAuthUser(data.user);
            setUser(nextUser);
            setRole(nextUser.role as UserRole);

            // Bind device immediately. If conflict, sign the user back out and
            // route to DeviceConflict so they can resolve it.
            const bindResult = await handleBind();
            if (!bindResult.ok && 'conflict' in bindResult && bindResult.conflict) {
                await handleBindConflict(bindResult.message);
                return { ok: false, message: bindResult.message };
            }

            return { ok: true };
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 403) {
                setPendingEmail(email.trim());
                return { ok: false, unverified: true, message: extractError(err) };
            }
            return { ok: false, unverified: false, message: extractError(err) };
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Sign out ──────────────────────────────────────────────────────────────
    const signOut = async () => {
        try {
            const refreshToken = await getRefreshToken();
            await authApi.logout({ refresh_token: refreshToken ?? undefined });
        } catch { /* best-effort */ } finally {
            await clearAuthStorage();
            // Keep deviceUid persisted so the same device re-binds on next login.
            // Only the push token is invalidated server-side.
            await removeStoredPushToken();
            setUser(null);
            setRole('student');
            setPendingRegistration(null);
            setPendingEmail(null);
            setPasswordResetEmail(null);
            setBindStatus('idle');
        }
    };

    // ── Register ──────────────────────────────────────────────────────────────
    const startRegistration = async (data: PendingRegistration) => {
        setAuthLoading(true);
        try {
            const email = data.email.trim().toLowerCase();
            await authApi.register({
                name: data.name.trim(),
                email,
                password: data.password,
                password_confirmation: data.password,
                role: data.role,
                matric_no: data.role === 'student' ? data.matricNo?.trim() : undefined,
            });

            setPendingRegistration({ ...data, email });
            setPendingEmail(email);
            return { ok: true };
        } catch (err) {
            return { ok: false, message: extractError(err) };
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Verify email (registration) ───────────────────────────────────────────
    const verifyRegistrationEmail = async (code: string) => {
        if (!pendingEmail) return { ok: false, message: 'No pending registration found.' };

        setAuthLoading(true);
        try {
            const { data } = await authApi.verifyEmailCode({ email: pendingEmail, code });
            await setAccessToken(data.tokens.access_token);
            await setRefreshToken(data.tokens.refresh_token);
            await setUserData(data.user);

            const nextUser = apiUserToAuthUser(data.user, pendingRegistration?.invite);
            setUser(nextUser);
            setRole(nextUser.role as UserRole);
            setPendingRegistration(null);
            setPendingEmail(null);

            // Bind device on first sign-in after registration.
            const bindResult = await handleBind();
            if (!bindResult.ok && 'conflict' in bindResult && bindResult.conflict) {
                await handleBindConflict(bindResult.message);
                return { ok: false, message: bindResult.message };
            }

            return { ok: true };
        } catch (err) {
            return { ok: false, message: extractError(err, 'Invalid or expired code.') };
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Resend verification code ──────────────────────────────────────────────
    const resendVerificationCode = async () => {
        if (!pendingEmail) return;
        try {
            await authApi.resendEmailCode({ email: pendingEmail });
        } catch { /* ignore – UI already shows resend button */ }
    };

    // ── Forgot password ───────────────────────────────────────────────────────
    const requestPasswordReset = async (email: string) => {
        setAuthLoading(true);
        try {
            const normalized = email.trim().toLowerCase();
            await authApi.forgotPassword({ email: normalized });
            setPasswordResetEmail(normalized);
            setPendingEmail(normalized);
            return { ok: true };
        } catch (err) {
            return { ok: false, message: extractError(err) };
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Reset password ────────────────────────────────────────────────────────
    const resetPassword = async (code: string, nextPassword: string, emailOverride?: string) => {
        const email = emailOverride ?? passwordResetEmail;
        if (!email) return { ok: false, message: 'No password reset request found.' };

        setAuthLoading(true);
        try {
            await authApi.resetPassword({
                email,
                code: code.trim(),
                password: nextPassword,
                password_confirmation: nextPassword,
            });
            setPasswordResetEmail(null);
            setPendingEmail(null);
            return { ok: true };
        } catch (err) {
            return { ok: false, message: extractError(err, 'Invalid reset code.') };
        } finally {
            setAuthLoading(false);
        }
    };

    const value = useMemo<AuthContextType>(
        () => ({
            isAuthenticated: Boolean(user),
            user,
            authLoading,
            isInitialising,
            pendingRegistration,
            pendingEmail,
            bindStatus,
            signIn,
            signOut,
            startRegistration,
            verifyRegistrationEmail,
            resendVerificationCode,
            requestPasswordReset,
            resetPassword,
            rebindDevice,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user, authLoading, isInitialising, pendingRegistration, pendingEmail, bindStatus],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
