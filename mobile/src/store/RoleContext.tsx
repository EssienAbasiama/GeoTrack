import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * User Role Types
 * - Student: Can view classes, check-in/out
 * - Lecturer: Can view assigned classes, take attendance
 * - HOC (Head of Class): Can manage class attendance
 * - SuperAdmin (HOD): Can create classes, lecturers, assign lecturers
 */
export type UserRole = 'student' | 'lecturer' | 'hoc' | 'superadmin';

export interface RoleContextType {
    role: UserRole;
    setRole: (role: UserRole) => void;
    isStudent: boolean;
    isLecturer: boolean;
    isHOC: boolean;
    isSuperAdmin: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
    children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
    const [role, setRole] = useState<UserRole>('student');

    const value: RoleContextType = {
        role,
        setRole,
        isStudent: role === 'student',
        isLecturer: role === 'lecturer',
        isHOC: role === 'hoc',
        isSuperAdmin: role === 'superadmin',
    };

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextType {
    const context = useContext(RoleContext);
    if (!context) {
        throw new Error('useRole must be used within a RoleProvider');
    }
    return context;
}

/**
 * Role display labels for UI
 */
export const ROLE_LABELS: Record<UserRole, string> = {
    student: 'Student',
    lecturer: 'Lecturer',
    hoc: 'Head of Class (HOC)',
    superadmin: 'Super Admin (HOD)',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    student: 'View classes and check-in to attendance',
    lecturer: 'Manage assigned classes and attendance',
    hoc: 'Head of Class responsibilities',
    superadmin: 'Create classes, lecturers and manage assignments',
};
