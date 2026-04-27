import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AttendanceControlMap = Record<string, boolean>;

interface AttendanceControlContextType {
    attendanceEnabledByClass: AttendanceControlMap;
    isAttendanceEnabled: (classCode: string) => boolean;
    setAttendanceEnabled: (classCode: string, enabled: boolean) => void;
    toggleAttendanceEnabled: (classCode: string) => void;
}

const AttendanceControlContext = createContext<AttendanceControlContextType | undefined>(undefined);

interface AttendanceControlProviderProps {
    children: ReactNode;
}

export function AttendanceControlProvider({ children }: AttendanceControlProviderProps) {
    const [attendanceEnabledByClass, setAttendanceEnabledByClass] = useState<AttendanceControlMap>({});

    const value = useMemo<AttendanceControlContextType>(() => {
        const isAttendanceEnabled = (classCode: string) => Boolean(attendanceEnabledByClass[classCode]);

        const setAttendanceEnabled = (classCode: string, enabled: boolean) => {
            setAttendanceEnabledByClass((prev) => ({
                ...prev,
                [classCode]: enabled,
            }));
        };

        const toggleAttendanceEnabled = (classCode: string) => {
            setAttendanceEnabledByClass((prev) => ({
                ...prev,
                [classCode]: !prev[classCode],
            }));
        };

        return {
            attendanceEnabledByClass,
            isAttendanceEnabled,
            setAttendanceEnabled,
            toggleAttendanceEnabled,
        };
    }, [attendanceEnabledByClass]);

    return <AttendanceControlContext.Provider value={value}>{children}</AttendanceControlContext.Provider>;
}

export function useAttendanceControl(): AttendanceControlContextType {
    const context = useContext(AttendanceControlContext);
    if (!context) {
        throw new Error('useAttendanceControl must be used within an AttendanceControlProvider');
    }
    return context;
}
