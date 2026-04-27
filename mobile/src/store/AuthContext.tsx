import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRole, type UserRole } from './RoleContext';

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

interface AuthContextType {
    isAuthenticated: boolean;
    user: AuthUser | null;
    authLoading: boolean;
    pendingRegistration: PendingRegistration | null;
    pendingEmail: string | null;
    signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
    signOut: () => void;
    startRegistration: (data: PendingRegistration) => Promise<{ ok: boolean; message?: string }>;
    verifyRegistrationEmail: (code: string) => Promise<{ ok: boolean; message?: string }>;
    resendVerificationCode: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string }>;
    resetPassword: (code: string, nextPassword: string) => Promise<{ ok: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

const MOCK_VERIFICATION_CODE = '246810';
const MOCK_RESET_CODE = '135790';

export function AuthProvider({ children }: AuthProviderProps) {
    const { setRole } = useRole();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(null);

    const signIn = async (email: string, password: string) => {
        setAuthLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !password.trim()) {
            setAuthLoading(false);
            return { ok: false, message: 'Please enter your email and password.' };
        }

        const inferredRole: RegisterRole = normalizedEmail.includes('lect') || normalizedEmail.includes('hod')
            ? 'lecturer'
            : 'student';

        const nextUser: AuthUser = {
            id: `usr_${Date.now()}`,
            name: inferredRole === 'lecturer' ? 'Lecturer User' : 'Student User',
            email: normalizedEmail,
            role: inferredRole,
            matricNo: inferredRole === 'student' ? 'TEMP-MATRIC' : undefined,
        };

        setUser(nextUser);
        setRole(inferredRole as UserRole);
        setAuthLoading(false);
        return { ok: true };
    };

    const signOut = () => {
        setUser(null);
        setRole('student');
    };

    const startRegistration = async (data: PendingRegistration) => {
        setAuthLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!data.name.trim() || !data.email.trim() || !data.password.trim()) {
            setAuthLoading(false);
            return { ok: false, message: 'Fill all required fields.' };
        }

        if (data.role === 'student' && !data.matricNo?.trim()) {
            setAuthLoading(false);
            return { ok: false, message: 'Matric number is required for students.' };
        }

        setPendingRegistration({
            ...data,
            email: data.email.trim().toLowerCase(),
        });
        setPendingEmail(data.email.trim().toLowerCase());
        setAuthLoading(false);
        return { ok: true };
    };

    const verifyRegistrationEmail = async (code: string) => {
        setAuthLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 400));

        if (!pendingRegistration) {
            setAuthLoading(false);
            return { ok: false, message: 'No pending registration found.' };
        }

        if (code !== MOCK_VERIFICATION_CODE) {
            setAuthLoading(false);
            return { ok: false, message: 'Invalid verification code.' };
        }

        const nextUser: AuthUser = {
            id: `usr_${Date.now()}`,
            name: pendingRegistration.name,
            email: pendingRegistration.email,
            role: pendingRegistration.role,
            matricNo: pendingRegistration.matricNo,
            invite: pendingRegistration.invite,
        };

        setUser(nextUser);
        setRole(pendingRegistration.role as UserRole);
        setPendingRegistration(null);
        setPendingEmail(null);
        setAuthLoading(false);
        return { ok: true };
    };

    const resendVerificationCode = async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
    };

    const requestPasswordReset = async (email: string) => {
        setAuthLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 400));

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setAuthLoading(false);
            return { ok: false, message: 'Enter your email address.' };
        }

        setPasswordResetEmail(normalizedEmail);
        setPendingEmail(normalizedEmail);
        setAuthLoading(false);
        return { ok: true };
    };

    const resetPassword = async (code: string, nextPassword: string) => {
        setAuthLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 400));

        if (!passwordResetEmail) {
            setAuthLoading(false);
            return { ok: false, message: 'No password reset request found.' };
        }

        if (code !== MOCK_RESET_CODE) {
            setAuthLoading(false);
            return { ok: false, message: 'Invalid reset code.' };
        }

        if (!nextPassword.trim()) {
            setAuthLoading(false);
            return { ok: false, message: 'Enter a new password.' };
        }

        setPasswordResetEmail(null);
        setPendingEmail(null);
        setAuthLoading(false);
        return { ok: true };
    };

    const value = useMemo<AuthContextType>(() => ({
        isAuthenticated: Boolean(user),
        user,
        authLoading,
        pendingRegistration,
        pendingEmail,
        signIn,
        signOut,
        startRegistration,
        verifyRegistrationEmail,
        resendVerificationCode,
        requestPasswordReset,
        resetPassword,
    }), [user, authLoading, pendingRegistration, pendingEmail]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
