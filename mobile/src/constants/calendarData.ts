export type AttendanceRecord = {
  day: number;
  checkIn: string;
  checkOut: string;
  total: string;
  active?: boolean;
};

export type ClassAttendance = {
  id: string;
  code: string;
  title: string;
  attendanceCount: number;
  absenceCount: number;
  records: AttendanceRecord[];
};

export const CLASS_ATTENDANCE_DATA: ClassAttendance[] = [
  {
    id: 'ele-512',
    code: 'ELE 512',
    title: 'Digital Signal Processing',
    attendanceCount: 15,
    absenceCount: 3,
    records: [
      { day: 11, checkIn: '10:02 AM', checkOut: '-- : --', total: '07:20h', active: true },
      { day: 10, checkIn: '10:00 AM', checkOut: '07:00 PM', total: '09:00h' },
      { day: 9, checkIn: '10:10 AM', checkOut: '06:20 PM', total: '08:10h' },
    ],
  },
  {
    id: 'csc-431',
    code: 'CSC 431',
    title: 'Operating Systems',
    attendanceCount: 13,
    absenceCount: 2,
    records: [
      { day: 11, checkIn: '08:56 AM', checkOut: '11:00 AM', total: '02:04h', active: true },
      { day: 10, checkIn: '09:01 AM', checkOut: '11:10 AM', total: '02:09h' },
      { day: 9, checkIn: '09:04 AM', checkOut: '10:58 AM', total: '01:54h' },
    ],
  },
  {
    id: 'mth-305',
    code: 'MTH 305',
    title: 'Numerical Methods',
    attendanceCount: 17,
    absenceCount: 1,
    records: [
      { day: 11, checkIn: '01:08 PM', checkOut: '03:00 PM', total: '01:52h', active: true },
      { day: 10, checkIn: '01:00 PM', checkOut: '02:55 PM', total: '01:55h' },
      { day: 9, checkIn: '01:03 PM', checkOut: '03:01 PM', total: '01:58h' },
    ],
  },
];
