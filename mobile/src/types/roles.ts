/**
 * User Role Types for GeoTrack
 */
export type UserRole = 'student' | 'lecturer' | 'hoc' | 'superadmin';

/**
 * Class Entity
 */
export interface ClassEntity {
    id: string;
    code: string;
    name: string;
    venue: string;
    day: string;
    startTime: string;
    endTime: string;
    lecturerName?: string;
    lecturerId?: string;
    totalStudents?: number;
    attendanceRate?: number;
}

/**
 * Lecturer Entity
 */
export interface LecturerEntity {
    id: string;
    name: string;
    email: string;
    department: string;
    assignedClasses: string[];
}

/**
 * Student Entity
 */
export interface StudentEntity {
    id: string;
    name: string;
    matricNumber: string;
    email: string;
    department: string;
    level: string;
}

/**
 * Attendance Record
 */
export interface AttendanceRecord {
    id: string;
    classId: string;
    studentId: string;
    checkInTime: string;
    checkOutTime?: string;
    status: 'present' | 'late' | 'absent';
    date: string;
}
