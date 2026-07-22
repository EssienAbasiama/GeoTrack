import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Pressable, Share, Text, TextInput, View, Image } from 'react-native';
import * as Linking from 'expo-linking';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useRole } from '../store/RoleContext';
import { useAuth } from '../store/AuthContext';
import { useAttendanceControl } from '../store/AttendanceControlContext';
import { AddStudentBottomSheet, type AddStudentBottomSheetRef } from '../components/AddStudentBottomSheet';
import { SetBoundaryBottomSheet, type SetBoundaryBottomSheetRef, type ClassBoundary } from '../components/SetBoundaryBottomSheet';
import { VenuePickerBottomSheet, type VenuePickerBottomSheetRef } from '../components/VenuePickerBottomSheet';
import { EditClassBottomSheet, type EditClassBottomSheetRef, type EditClassValues } from '../components/EditClassBottomSheet';
import { AssignLecturerBottomSheet, type AssignLecturerBottomSheetRef, type AssignedLecturer } from '../components/AssignLecturerBottomSheet';
import { LocationCheckBottomSheet, type LocationCheckBottomSheetRef } from '../components/LocationCheckBottomSheet';
import { celebrationPattern } from '../utils/haptics';
import { notifyCheckInSuccess } from '../services/notifications';
import { courseApi, geofenceApi, sessionApi, inviteApi } from '../services/apiClient';
import { formatTimeRange } from '../utils/time';
import { shareCsv } from '../utils/downloadCsv';
import type { ApiCourseStudent } from '../types/api';

const PRIMARY_COLOR = '#6343cc';
const PRIMARY_LIGHT = '#8B6FE8'; // Lighter shade for lecturer/HOC

interface Student {
    id: string;
    name: string;
    matricNo: string;
    email: string;
    avatar?: string | null;
    attendanceRate: number;
}

interface Lecturer {
    id?: number | null;
    name: string;
    email: string;
    department: string;
    avatar?: string | null;
}

// ─── Avatar helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6343cc', '#0284C7', '#16A34A', '#CA8A04', '#E11D48', '#9333EA', '#0891B2', '#DB2777'];

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Shows the photo when a URL exists, otherwise a colored initials circle. */
function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                resizeMode="cover"
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: avatarColor(name),
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text style={{ color: '#fff', fontSize: size * 0.38, fontFamily: 'WorkSans_600SemiBold' }}>
                {getInitials(name)}
            </Text>
        </View>
    );
}

function StudentCard({
    item,
    index,
    onPress,
    canViewDetails
}: {
    item: Student;
    index: number;
    onPress?: () => void;
    canViewDetails: boolean;
}) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay: index * 60,
                useNativeDriver: true,
                speed: 14,
                bounciness: 4,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                delay: index * 60,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [index]);

    const getAttendanceColor = (rate: number) => {
        if (rate >= 90) return '#22C55E';
        if (rate >= 75) return '#F59E0B';
        return '#EF4444';
    };

    return (
        <Animated.View
            style={{
                opacity: scaleAnim,
                transform: [{ translateY }],
            }}
        >
            <Pressable
                onPress={canViewDetails ? onPress : undefined}
                className="mb-3 rounded-[16px] bg-white p-4 flex-row items-center shadow-sm shadow-black/5"
                style={({ pressed }) => canViewDetails ? { opacity: pressed ? 0.7 : 1 } : {}}
            >
                <Avatar name={item.name} uri={item.avatar} size={48} />
                <View className="ml-3 flex-1">
                    <Text className="font-heading text-[15px] text-[#181A20]">{item.name}</Text>
                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">{item.matricNo}</Text>
                </View>
                <View className="items-end">
                    <View className="flex-row items-center">
                        <View
                            className="h-2 w-2 rounded-full mr-1.5"
                            style={{ backgroundColor: getAttendanceColor(item.attendanceRate) }}
                        />
                        <Text
                            className="font-medium text-[14px]"
                            style={{ color: getAttendanceColor(item.attendanceRate) }}
                        >
                            {item.attendanceRate}%
                        </Text>
                    </View>
                    <Text className="text-[10px] text-[#B8BBC6] mt-0.5">Attendance</Text>
                </View>
                {canViewDetails && (
                    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={{ marginLeft: 8 }} />
                )}
            </Pressable>
        </Animated.View>
    );
}

export function ClassDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
    const { isHOC, isSuperAdmin, isStudent, isLecturer } = useRole();
    const { user } = useAuth();
    const { isAttendanceEnabled, setAttendanceEnabled } = useAttendanceControl();
    const { classId, classCode, className, venue, day, startTime, endTime } = route.params;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const fabBounce = useRef(new Animated.Value(1)).current;
    const locationFabBounce = useRef(new Animated.Value(1)).current;
    const addStudentRef = useRef<AddStudentBottomSheetRef>(null);
    const venuePickerRef = useRef<VenuePickerBottomSheetRef>(null);
    const setLocationRef = useRef<SetBoundaryBottomSheetRef>(null);
    const locationCheckRef = useRef<LocationCheckBottomSheetRef>(null);
    const editClassRef = useRef<EditClassBottomSheetRef>(null);
    const assignLecturerRef = useRef<AssignLecturerBottomSheetRef>(null);
    const searchInputRef = useRef<TextInput>(null);

    const [students, setStudents] = useState<Student[]>([]);
    const [lecturer, setLecturer] = useState<Lecturer | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [courseVenue, setCourseVenue] = useState<string | null>(venue ?? null);
    // Editable class info kept in state so edits reflect immediately.
    const [classInfo, setClassInfo] = useState({
        code: classCode,
        name: className,
        department: '',
        day,
        startTime,
        endTime,
    });
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
    const [togglingAttendance, setTogglingAttendance] = useState(false);
    const [downloadingCsv, setDownloadingCsv] = useState(false);
    // Most recent session (active or closed) so a lecturer can open it to view
    // the day's attendance and download the CSV after class.
    const [latestSessionId, setLatestSessionId] = useState<number | null>(null);
    const searchAnim = useRef(new Animated.Value(0)).current;
    const checkInPulse = useRef(new Animated.Value(1)).current;
    const fabRotate = useRef(new Animated.Value(0)).current;

    // Class boundary loaded from the backend geofence; null until configured.
    const [classLocation, setClassLocation] = useState<ClassBoundary | null>(null);

    // ── Backend wiring ───────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [courseRes, studentsRes, fenceRes, sessionRes, sessionsListRes] = await Promise.all([
                    courseApi.get(classId).catch(() => null),
                    courseApi.students(classId).catch(() => null),
                    geofenceApi.get(classId).catch(() => null),
                    sessionApi.active(classId).catch(() => null),
                    sessionApi.list(classId).catch(() => null),
                ]);
                if (!mounted) return;

                const course = courseRes?.data?.course;
                if (course?.venue?.trim()) {
                    setCourseVenue(course.venue.trim());
                }
                if (course) {
                    setClassInfo((prev) => ({
                        ...prev,
                        code: course.code ?? prev.code,
                        name: course.title ?? course.name ?? prev.name,
                        department: course.department ?? prev.department,
                        day: course.day ?? prev.day,
                        startTime: course.start_time ?? prev.startTime,
                        endTime: course.end_time ?? prev.endTime,
                    }));
                }
                if (course?.lecturer) {
                    setLecturer({
                        id: course.lecturer.id,
                        name: course.lecturer.name,
                        email: course.lecturer.email,
                        department: course.department ?? '',
                        avatar: null,
                    });
                } else if (course?.lecturer_name) {
                    setLecturer({
                        id: course.lecturer_id ?? null,
                        name: course.lecturer_name,
                        email: '',
                        department: course.department ?? '',
                        avatar: null,
                    });
                }

                if (studentsRes?.data?.students) {
                    setStudents(
                        studentsRes.data.students.map((s: ApiCourseStudent) => ({
                            id: String(s.id),
                            name: s.name,
                            matricNo: s.matric_no ?? '',
                            email: s.email,
                            avatar: s.avatar_url ?? null,
                            attendanceRate: s.attendance_rate ?? 0,
                        })),
                    );
                }

                const fence = fenceRes?.data?.geofence;
                if (fence && fence.center_lat != null && fence.center_lng != null) {
                    setClassLocation({
                        latitude: fence.center_lat,
                        longitude: fence.center_lng,
                        radius: fence.radius_m ?? 50,
                        polygonCoords: fence.polygon ?? undefined,
                        name: fence.name ?? venue,
                    });
                }

                // Set null when there's no session, otherwise a stale id lingers
                // and the attendance toggle acts on state that no longer exists.
                setActiveSessionId(sessionRes?.data?.session?.id ?? null);

                // Sessions come back ordered newest-first; keep the latest one so
                // the lecturer can reopen it to view/download attendance.
                const latest = sessionsListRes?.data?.sessions?.[0];
                if (latest?.id) {
                    setLatestSessionId(latest.id);
                } else if (sessionRes?.data?.session?.id) {
                    setLatestSessionId(sessionRes.data.session.id);
                }
            } catch {
                // Soft-fail: leave lists empty rather than showing stale data.
            } finally {
                if (mounted) setLoadingData(false);
            }
        })();
        return () => { mounted = false; };
    }, [classId, venue]);

    // Re-check the live session every time the screen regains focus. Without
    // this the id was only read on mount, so after starting a session and
    // navigating back the toggle was acting on stale state.
    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            sessionApi
                .active(classId)
                .then(({ data }) => {
                    if (mounted) setActiveSessionId(data.session?.id ?? null);
                })
                .catch(() => { /* keep last known state */ });
            return () => { mounted = false; };
        }, [classId]),
    );

    // Determine if class is currently active based on schedule
    const isClassActive = useMemo(() => {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

        // Check if it's the right day
        if (currentDay !== classInfo.day) return false;
        if (!classInfo.startTime || !classInfo.endTime) return false;

        // Parse start and end times
        const parseTime = (timeStr: string) => {
            const [time, period] = timeStr.split(' ');
            const [hours, minutes] = time.split(':').map(Number);
            let h = hours;
            if (period === 'PM' && hours !== 12) h += 12;
            if (period === 'AM' && hours === 12) h = 0;
            return h * 60 + minutes; // Convert to minutes
        };

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = parseTime(classInfo.startTime);
        const endMinutes = parseTime(classInfo.endTime);

        // Add 15 minutes grace period before class starts
        return currentMinutes >= (startMinutes - 15) && currentMinutes <= endMinutes;
    }, [classInfo.day, classInfo.startTime, classInfo.endTime]);

    // Attendance is open if and only if the SERVER has an active session.
    // This used to read local-only context state, which drifted out of sync:
    // the button still looked "off" after a session had started, so a second
    // tap took the close branch and silently ended the session that the first
    // tap had just opened.
    const isAttendanceOpen = activeSessionId != null;
    // A student can check in whenever an attendance session is active for the
    // class (sessions auto-open during the scheduled window). The lecturer-side
    // `isAttendanceOpen` toggle only drives the lecturer's own controls.
    const canStudentCheckIn = activeSessionId != null && !hasCheckedIn;

    // Check-in pulse animation for active class
    useEffect(() => {
        if (isStudent && canStudentCheckIn && classLocation) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(checkInPulse, {
                        toValue: 1.08,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(checkInPulse, {
                        toValue: 1,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isStudent, canStudentCheckIn, classLocation]);

    const handleLecturerAttendanceToggle = async () => {
        if (!isClassActive) {
            handleOpenDirections();
            return;
        }
        // Ignore taps while a start/close is in flight — an impatient second tap
        // used to close the session the first tap had just opened.
        if (togglingAttendance) return;

        setTogglingAttendance(true);
        try {
            if (activeSessionId) {
                await handleEndSession();
                setAttendanceEnabled(classCode, false);
            } else {
                await handleStartSession();
                setAttendanceEnabled(classCode, true);
            }
        } finally {
            setTogglingAttendance(false);
        }
    };

    const handleCheckInSuccess = useCallback(() => {
        setHasCheckedIn(true);

        // Celebration haptic feedback
        celebrationPattern();

        // Send notification
        notifyCheckInSuccess(classCode, className);

        Toast.show({ type: 'success', text1: 'Your attendance has been recorded for this class session.', position: "bottom" });
    }, [classCode, className]);

    const handleOpenDirections = () => {
        if (classLocation) {
            navigation.navigate('Navigation', {
                destination: {
                    latitude: classLocation.latitude,
                    longitude: classLocation.longitude,
                },
                classCode,
                className,
                locationName: classLocation.name,
            });
        }
    };

    // Filter students based on search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.matricNo.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    const toggleSearch = () => {
        if (searchVisible) {
            Animated.timing(searchAnim, {
                toValue: 0,
                duration: 250,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: false,
            }).start(() => {
                setSearchVisible(false);
                setSearchQuery('');
            });
        } else {
            setSearchVisible(true);
            Animated.timing(searchAnim, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start(() => searchInputRef.current?.focus());
        }
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Bounce animation for FABs (only for HOC)
        if (isHOC) {
            const bounceLoop = () => {
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(fabBounce, {
                            toValue: 1.1,
                            duration: 600,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(fabBounce, {
                            toValue: 1,
                            duration: 600,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.sequence([
                        Animated.timing(locationFabBounce, {
                            toValue: 1.1,
                            duration: 600,
                            delay: 300, // Offset the second FAB bounce
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(locationFabBounce, {
                            toValue: 1,
                            duration: 600,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                ]).start(() => bounceLoop());
            };
            bounceLoop();
        }
    }, [isHOC]);

    const handleAddStudent = async (student: { id: number; name: string; matricNo: string; email: string }) => {
        const studentId = String(student.id);
        if (students.some((s) => s.id === studentId)) return;

        const newStudent: Student = {
            ...student,
            id: studentId,
            avatar: null,
            attendanceRate: 0,
        };
        setStudents((prev) => [...prev, newStudent]);

        try {
            // Enrol by id — the search already resolved the exact student, so this
            // works whether the lecturer looked them up by email, matric or name.
            await courseApi.enroll(classId, { user_id: student.id });
            Toast.show({ type: 'success', text1: `${student.name} enrolled.`, position: 'bottom' });
        } catch (err) {
            // Roll the optimistic row back so the list matches the server.
            setStudents((prev) => prev.filter((s) => s.id !== studentId));
            const msg = (err as any)?.response?.data?.message ?? 'Could not enroll student.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    const handleSaveLocation = async (location: ClassBoundary) => {
        setClassLocation(location);
        // Reflect the new location name in the Venue field immediately.
        const venueName = location.name?.trim();
        if (venueName) setCourseVenue(venueName);
        try {
            const polygon = location.polygonCoords;
            await geofenceApi.upsert(classId, {
                shape: polygon && polygon.length >= 3 ? 'polygon' : 'circle',
                center_lat: location.latitude,
                center_lng: location.longitude,
                radius_m: location.radius ?? 50,
                polygon: polygon ?? undefined,
                label: location.name,
            });
            // Keep the course's venue text in sync so it persists and the
            // My Classes list reflects the new location too.
            if (venueName) {
                await courseApi.update(classId, { venue: venueName }).catch(() => {});
            }
            Toast.show({ type: 'success', text1: 'Location saved.', position: 'bottom' });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not save location.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    const handleSelectExistingVenue = useCallback((location: ClassBoundary) => {
        handleSaveLocation(location);
    }, []);

    const handleOpenBoundaryDraw = useCallback(() => {
        // "Draw GPS Boundary" is always a create-new action — start with a clean map.
        setLocationRef.current?.open({ fresh: true });
    }, []);

    // ── Class management (edit / delete / share) ─────────────────────────────
    const isHOD = isHOC || isSuperAdmin;            // HOD: manages classes
    const canEditLocation = isHOC || isLecturer || isSuperAdmin;
    const canEditClass = isHOD || isLecturer;       // HOD + lecturer edit details
    const canDeleteClass = isSuperAdmin;            // only superadmin deletes
    const canShareStudents = isHOC || isSuperAdmin || isLecturer;
    const canManage = canEditLocation || canEditClass || canDeleteClass || canShareStudents;

    const handleLecturerAssigned = useCallback((assigned: AssignedLecturer) => {
        setLecturer((prev) => ({
            id: assigned.id,
            name: assigned.name,
            email: assigned.email,
            department: prev?.department ?? '',
            avatar: null,
        }));
    }, []);

    const handleShareInvite = async (role: 'student' | 'lecturer') => {
        setMenuVisible(false);
        try {
            const { data } = await inviteApi.create(classId, { role });
            const token = data.invite.token;
            const url = Linking.createURL(`join/${token}`);
            const label = role === 'lecturer' ? 'as the lecturer' : 'as a member';
            await Share.share({
                message: `Join ${classInfo.code} — ${classInfo.name} ${label} on GeoTrack:\n${url}`,
            });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not create the invite link.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    const handleEditLocation = () => {
        setMenuVisible(false);
        venuePickerRef.current?.open();
    };

    const handleOpenEditClass = () => {
        setMenuVisible(false);
        editClassRef.current?.open({
            code: classInfo.code,
            title: classInfo.name,
            department: classInfo.department,
            venue: courseVenue ?? '',
            day: classInfo.day,
            startTime: classInfo.startTime,
            endTime: classInfo.endTime,
        });
    };

    const handleSaveEditClass = useCallback(async (values: EditClassValues) => {
        try {
            await courseApi.update(classId, {
                code: values.code,
                title: values.title,
                department: values.department || undefined,
                venue: values.venue || undefined,
                day: values.day || undefined,
                start_time: values.startTime || undefined,
                end_time: values.endTime || undefined,
            });
            setClassInfo((prev) => ({
                ...prev,
                code: values.code,
                name: values.title,
                department: values.department,
                day: values.day,
                startTime: values.startTime,
                endTime: values.endTime,
            }));
            setCourseVenue(values.venue || null);
            Toast.show({ type: 'success', text1: 'Class updated.', position: 'bottom' });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not update class.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
            throw err;
        }
    }, [classId]);

    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            await courseApi.delete(classId);
            setDeleteVisible(false);
            Toast.show({ type: 'success', text1: 'Class deleted.', position: 'bottom' });
            navigation.goBack();
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not delete class.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadTodayAttendance = async () => {
        if (downloadingCsv) return;
        setDownloadingCsv(true);
        try {
            const csv = await courseApi.todayAttendanceCsv(classId);
            const date = new Date().toISOString().slice(0, 10);
            await shareCsv(
                csv,
                `${classInfo.code}_${date}_attendance.csv`,
                `${classInfo.code} attendance`,
            );
            setMenuVisible(false);
        } catch (err) {
            const msg =
                (err as any)?.response?.data?.message ?? 'Could not download attendance.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setDownloadingCsv(false);
        }
    };

    const handleStartSession = async () => {
        try {
            const { data } = await sessionApi.start(classId);
            setActiveSessionId(data.session.id);
            setLatestSessionId(data.session.id);
            navigation.navigate('LecturerSession', {
                sessionId: data.session.id,
                courseId: classId,
                classCode,
                className,
            });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not start session.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    const handleEndSession = async () => {
        if (!activeSessionId) return;
        try {
            await sessionApi.close(activeSessionId);
            setActiveSessionId(null);
            Toast.show({ type: 'success', text1: 'Session closed.', position: 'bottom' });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not close session.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <Animated.View
                style={{
                    flex: 1,
                    opacity: fadeAnim,
                    transform: [
                        {
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [12, 0],
                            }),
                        },
                    ],
                }}
            >
                {/* Header */}
                <View className="px-5 pt-3 pb-4">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={() => navigation.goBack()}
                            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5 mr-3"
                        >
                            <Ionicons name="arrow-back" size={20} color="#181A20" />
                        </Pressable>
                        <View className="flex-1">
                            <Text className="font-heading text-[22px] text-[#181A20]">{classInfo.code}</Text>
                            <Text className="text-[13px] text-[#8F94A4]">{classInfo.name}</Text>
                        </View>
                        {canManage && (
                            <Pressable
                                onPress={() => setMenuVisible(true)}
                                className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
                            >
                                <Feather name="more-vertical" size={18} color="#5A5D6B" />
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Lecturer: open the latest session to view & download attendance */}
                {(isLecturer || isSuperAdmin) && latestSessionId && (
                    <View className="px-5 mb-4">
                        <Pressable
                            onPress={() =>
                                navigation.navigate('LecturerSession', {
                                    sessionId: latestSessionId,
                                    courseId: classId,
                                    classCode,
                                    className,
                                })
                            }
                            className="flex-row items-center rounded-[16px] bg-white p-4 shadow-sm shadow-black/5"
                        >
                            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F0EDFC]">
                                <Ionicons name="document-text-outline" size={18} color={PRIMARY_COLOR} />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text className="font-medium text-[14px] text-[#181A20]">
                                    Today&apos;s attendance
                                </Text>
                                <Text className="text-[12px] text-[#8F94A4]">
                                    View check-ins and download CSV
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#B8BBC6" />
                        </Pressable>
                    </View>
                )}

                {/* Class Schedule Details */}
                <View className="px-5 mb-4">
                    <View className="rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                        <Text className="text-[12px] text-[#8F94A4] mb-3">Class Schedule</Text>
                        <View className="flex-row flex-wrap">
                            {/* Location */}
                            <View className="w-1/2 flex-row items-center mb-3 pr-2">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5E9]">
                                    <Ionicons name="location" size={18} color="#4CAF50" />
                                </View>
                                <View className="ml-3">
                                    <Text className="text-[10px] text-[#B8BBC6]">Venue</Text>
                                    <Text className="font-medium text-[14px] text-[#181A20]">
                                        {courseVenue?.trim() || classLocation?.name?.trim() || 'Not set'}
                                    </Text>
                                </View>
                            </View>
                            {/* Day */}
                            <View className="w-1/2 flex-row items-center mb-3 pl-2">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#FFF3E0]">
                                    <Ionicons name="calendar" size={18} color="#FF9800" />
                                </View>
                                <View className="ml-3">
                                    <Text className="text-[10px] text-[#B8BBC6]">Day</Text>
                                    <Text className="font-medium text-[14px] text-[#181A20]">{classInfo.day || 'Not set'}</Text>
                                </View>
                            </View>
                            {/* Time */}
                            <View className="w-full flex-row items-center">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD]">
                                    <Ionicons name="time" size={18} color="#2196F3" />
                                </View>
                                <View className="ml-3">
                                    <Text className="text-[10px] text-[#B8BBC6]">Time</Text>
                                    <Text className="font-medium text-[14px] text-[#181A20]">
                                        {formatTimeRange(classInfo.startTime, classInfo.endTime) || 'Not set'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Assigned Lecturer */}
                <View className="px-5 mb-4">
                    <View className="rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                        <Text className="text-[12px] text-[#8F94A4] mb-3">Assigned Lecturer</Text>
                        {lecturer ? (
                            <View className="flex-row items-center">
                                <Avatar name={lecturer.name} uri={lecturer.avatar} size={48} />
                                <View className="ml-3 flex-1">
                                    <Text className="font-heading text-[16px] text-[#181A20]">{lecturer.name}</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                        {lecturer.department || lecturer.email || 'Lecturer'}
                                    </Text>
                                </View>
                                {isHOD ? (
                                    // Only the HOD can change an already-assigned lecturer.
                                    <Pressable
                                        onPress={() => assignLecturerRef.current?.open()}
                                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F0EDFC]"
                                    >
                                        <Ionicons name="create-outline" size={16} color={PRIMARY_COLOR} />
                                    </Pressable>
                                ) : (
                                    <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F0EDFC]">
                                        <Ionicons name="mail" size={16} color={PRIMARY_COLOR} />
                                    </View>
                                )}
                            </View>
                        ) : isHOD && !loadingData ? (
                            // Unassigned: HOD can assign a lecturer.
                            <Pressable
                                onPress={() => assignLecturerRef.current?.open()}
                                className="flex-row items-center active:opacity-70"
                            >
                                <View className="h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9]">
                                    <Ionicons name="person-add" size={22} color="#4CAF50" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">Assign a lecturer</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Tap to choose from your institution</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        ) : (
                            <View className="flex-row items-center">
                                <View className="h-12 w-12 items-center justify-center rounded-full bg-[#F1F2F6]">
                                    <Ionicons name="person-outline" size={22} color="#B8BBC6" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="font-medium text-[15px] text-[#8F94A4]">
                                        {loadingData ? 'Loading…' : 'No lecturer assigned'}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Stats */}
                <View className="px-5 mb-4">
                    <View className="flex-row gap-3">
                        <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F0EDFC] mb-2">
                                <Ionicons name="people" size={18} color={PRIMARY_COLOR} />
                            </View>
                            <Text className="font-heading text-[22px] text-[#181A20]">{students.length}</Text>
                            <Text className="text-[12px] text-[#8F94A4]">Students</Text>
                        </View>
                        <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5E9] mb-2">
                                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                            </View>
                            <Text className="font-heading text-[22px] text-[#181A20]">
                                {students.length > 0
                                    ? Math.round(students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length)
                                    : 0}%
                            </Text>
                            <Text className="text-[12px] text-[#8F94A4]">Avg. Attendance</Text>
                        </View>
                    </View>
                </View>

                {/* Section Header */}
                <View className="px-5 mb-3">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="font-heading text-[16px] text-[#181A20]">Enrolled Students</Text>
                        <View className="flex-row items-center gap-2">
                            <Pressable
                                onPress={toggleSearch}
                                className="h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
                            >
                                <Feather name={searchVisible ? 'x' : 'search'} size={14} color="#5A5D6B" />
                            </Pressable>
                            <View className="px-2 py-1 rounded-full bg-[#F0EDFC]">
                                <Text className="text-[11px] font-medium text-[#6343cc]">{students.length} total</Text>
                            </View>
                        </View>
                    </View>

                    {/* Search Bar */}
                    {searchVisible && (
                        <Animated.View
                            style={{
                                opacity: searchAnim,
                                maxHeight: searchAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 52],
                                }),
                                overflow: 'hidden',
                            }}
                        >
                            <View className="flex-row items-center h-[44px] rounded-[12px] bg-white border border-[#E8EAF1] px-3">
                                <Feather name="search" size={14} color="#8F94A4" />
                                <TextInput
                                    ref={searchInputRef}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search students by name or matric no..."
                                    placeholderTextColor="#B8BBC6"
                                    className="flex-1 ml-2 text-[13px] text-[#181A20]"
                                    returnKeyType="search"
                                />
                                {searchQuery.length > 0 && (
                                    <Pressable onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color="#B8BBC6" />
                                    </Pressable>
                                )}
                            </View>
                        </Animated.View>
                    )}
                </View>

                {/* Student List */}
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <StudentCard
                            item={item}
                            index={index}
                            canViewDetails={!isStudent}
                            onPress={() => {
                                navigation.navigate('StudentDetail', {
                                    studentId: item.id,
                                    studentName: item.name,
                                    matricNo: item.matricNo,
                                    email: item.email,
                                    avatar: item.avatar ?? '',
                                    courseId: classId,
                                    classCode,
                                    className,
                                });
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        loadingData ? (
                            <View className="items-center py-10">
                                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                <Text className="text-[13px] text-[#8F94A4] mt-3">Loading students…</Text>
                            </View>
                        ) : searchQuery.trim() ? (
                            <View className="items-center py-8">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF3E0] mb-3">
                                    <Ionicons name="search" size={28} color="#FF9800" />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No students found</Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1">Try a different search term</Text>
                            </View>
                        ) : (
                            <View className="items-center py-8">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                    <Ionicons name="people-outline" size={28} color={PRIMARY_COLOR} />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No students enrolled yet</Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                    Enrolled students will appear here
                                </Text>
                            </View>
                        )
                    }
                />
            </Animated.View>

            {/* Floating Action Buttons */}
            {/* Smart Check-In/Directions Button for Students */}
            {isStudent && classLocation && (
                <Pressable
                    onPress={() => {
                        if (canStudentCheckIn) {
                            navigation.navigate('CheckIn', {
                                courseId: classId,
                                classCode,
                                className,
                            });
                        } else {
                            handleOpenDirections();
                        }
                    }}
                    style={{ position: 'absolute', bottom: 100, right: 20 }}
                >
                    <Animated.View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: canStudentCheckIn ? '#4CAF50' : PRIMARY_COLOR,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: canStudentCheckIn ? '#4CAF50' : PRIMARY_COLOR,
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 8 },
                            elevation: 10,
                            transform: [{ scale: canStudentCheckIn ? checkInPulse : 1 }],
                        }}
                    >
                        {hasCheckedIn ? (
                            <Ionicons name="checkmark-circle" size={30} color="#fff" />
                        ) : canStudentCheckIn ? (
                            <MaterialCommunityIcons name="account-check" size={30} color="#fff" />
                        ) : (
                            <MaterialIcons name="directions" size={28} color="#fff" />
                        )}
                    </Animated.View>
                    {/* Label under the FAB */}
                    <View style={{ position: 'absolute', bottom: -22, left: -10, right: -10, alignItems: 'center' }}>
                        <Text style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: canStudentCheckIn ? '#4CAF50' : PRIMARY_COLOR,
                        }}>
                            {hasCheckedIn ? 'Checked In' : canStudentCheckIn ? 'Clock In' : isClassActive ? 'Attendance Closed' : 'Directions'}
                        </Text>
                    </View>
                </Pressable>
            )}

            {/* Location Direction Button for Lecturers - Lighter Shade */}
            {isLecturer && classLocation && (
                <Pressable
                    onPress={handleLecturerAttendanceToggle}
                    style={{ position: 'absolute', bottom: 100, right: 20 }}
                >
                    <View
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: isClassActive
                                ? (isAttendanceOpen ? '#EF4444' : '#4CAF50')
                                : PRIMARY_LIGHT,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: isClassActive
                                ? (isAttendanceOpen ? '#EF4444' : '#4CAF50')
                                : PRIMARY_LIGHT,
                            shadowOpacity: 0.4,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                            elevation: 8,
                        }}
                    >
                        {isClassActive ? (
                            <MaterialCommunityIcons
                                name={isAttendanceOpen ? 'account-cancel' : 'account-check'}
                                size={28}
                                color="#fff"
                            />
                        ) : (
                            <MaterialIcons name="directions" size={28} color="#fff" />
                        )}
                    </View>
                </Pressable>
            )}

            {/* Location Direction Button for SuperAdmin - Primary Color */}
            {isSuperAdmin && classLocation && (
                <Pressable
                    onPress={() => locationCheckRef.current?.open()}
                    style={{ position: 'absolute', bottom: 100, right: 20 }}
                >
                    <View
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: PRIMARY_COLOR,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: PRIMARY_COLOR,
                            shadowOpacity: 0.4,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                            elevation: 8,
                        }}
                    >
                        <MaterialIcons name="directions" size={28} color="#fff" />
                    </View>
                </Pressable>
            )}

            {/* HOC FABs - Set Location, Add Student, and Directions */}
            {isHOC && (
                <>
                    {/* Directions FAB for HOC - Lighter Shade */}
                    {classLocation && (
                        <Pressable
                            onPress={() => locationCheckRef.current?.open()}
                            style={{ position: 'absolute', bottom: 240, right: 20 }}
                        >
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: PRIMARY_LIGHT,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    shadowColor: PRIMARY_LIGHT,
                                    shadowOpacity: 0.4,
                                    shadowRadius: 12,
                                    shadowOffset: { width: 0, height: 6 },
                                    elevation: 8,
                                }}
                            >
                                <MaterialIcons name="directions" size={24} color="#fff" />
                            </View>
                        </Pressable>
                    )}

                    {/* Set Location FAB - Lighter Shade */}
                    <Pressable
                        onPress={() => venuePickerRef.current?.open()}
                        style={{ position: 'absolute', bottom: 170, right: 20 }}
                    >
                        <Animated.View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: PRIMARY_LIGHT,
                                justifyContent: 'center',
                                alignItems: 'center',
                                transform: [{ scale: locationFabBounce }],
                                shadowColor: PRIMARY_LIGHT,
                                shadowOpacity: 0.4,
                                shadowRadius: 12,
                                shadowOffset: { width: 0, height: 6 },
                                elevation: 8,
                            }}
                        >
                            <MaterialIcons name="add-location-alt" size={26} color="#fff" />
                        </Animated.View>
                    </Pressable>

                    {/* Add Student FAB */}
                    <Pressable
                        onPress={() => addStudentRef.current?.open()}
                        style={{ position: 'absolute', bottom: 100, right: 20 }}
                    >
                        <Animated.View
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 30,
                                backgroundColor: PRIMARY_COLOR,
                                justifyContent: 'center',
                                alignItems: 'center',
                                transform: [{ scale: fabBounce }],
                                shadowColor: PRIMARY_COLOR,
                                shadowOpacity: 0.4,
                                shadowRadius: 12,
                                shadowOffset: { width: 0, height: 6 },
                                elevation: 8,
                            }}
                        >
                            <Ionicons name="person-add" size={26} color="#fff" />
                        </Animated.View>
                    </Pressable>
                </>
            )}

            {/* Bottom Sheets */}
            <AddStudentBottomSheet
                ref={addStudentRef}
                classCode={classCode}
                onAddStudent={handleAddStudent}
            />

            {canEditLocation && (
                <>
                    <VenuePickerBottomSheet
                        ref={venuePickerRef}
                        institutionId={user?.institutionId}
                        currentClassId={classId}
                        day={classInfo.day}
                        startTime={classInfo.startTime}
                        endTime={classInfo.endTime}
                        onSelectVenue={handleSelectExistingVenue}
                        onDrawBoundary={handleOpenBoundaryDraw}
                    />
                    <SetBoundaryBottomSheet
                        ref={setLocationRef}
                        classCode={classInfo.code}
                        onSaveLocation={handleSaveLocation}
                        existingLocation={classLocation}
                    />
                </>
            )}

            {canEditClass && (
                <EditClassBottomSheet ref={editClassRef} onSave={handleSaveEditClass} />
            )}

            {isHOD && (
                <AssignLecturerBottomSheet
                    ref={assignLecturerRef}
                    courseId={classId}
                    currentLecturerId={lecturer?.id ?? null}
                    onAssigned={handleLecturerAssigned}
                />
            )}

            {classLocation && (
                <LocationCheckBottomSheet
                    ref={locationCheckRef}
                    classLocation={classLocation}
                    classCode={classInfo.code}
                    className={classInfo.name}
                    isClassActive={isClassActive}
                    isAttendanceEnabled={isAttendanceOpen}
                    studentName="Student" // TODO: Replace with actual student name from auth
                    onCheckInSuccess={handleCheckInSuccess}
                />
            )}

            {/* Manage menu */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setMenuVisible(false)}>
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-white rounded-t-[24px] px-5 pt-3"
                        style={{ paddingBottom: 32 }}
                    >
                        <View className="items-center mb-3">
                            <View className="h-1 w-10 rounded-full bg-[#E2E0E8]" />
                        </View>
                        <Text className="font-heading text-[16px] text-[#181A20] mb-2">Manage Class</Text>

                        {canEditClass && (
                            <Pressable
                                onPress={handleDownloadTodayAttendance}
                                disabled={downloadingCsv}
                                className="flex-row items-center py-4 border-b border-[#F1F2F6] active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF3E0] mr-3">
                                    {downloadingCsv ? (
                                        <ActivityIndicator size="small" color="#FF9800" />
                                    ) : (
                                        <Ionicons name="download-outline" size={20} color="#FF9800" />
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">
                                        Download Today&apos;s Attendance
                                    </Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                        CSV: present/absent, score and grade
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        )}

                        {canShareStudents && (
                            <Pressable
                                onPress={() => handleShareInvite('student')}
                                className="flex-row items-center py-4 border-b border-[#F1F2F6] active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#E8F5E9] mr-3">
                                    <Ionicons name="share-social" size={20} color="#4CAF50" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">Share with Students</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Send a link to join this class</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        )}

                        {isHOD && (
                            <Pressable
                                onPress={() => handleShareInvite('lecturer')}
                                className="flex-row items-center py-4 border-b border-[#F1F2F6] active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#E3F2FD] mr-3">
                                    <Ionicons name="person-add" size={20} color="#2196F3" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">Invite a Lecturer</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Share a link to assign a lecturer</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        )}

                        {canEditLocation && (
                            <Pressable
                                onPress={handleEditLocation}
                                className="flex-row items-center py-4 border-b border-[#F1F2F6] active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#E8F5E9] mr-3">
                                    <Ionicons name="location" size={20} color="#4CAF50" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">Edit Location</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Pick a venue or draw a boundary</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        )}

                        {canEditClass && (
                            <Pressable
                                onPress={handleOpenEditClass}
                                className="flex-row items-center py-4 border-b border-[#F1F2F6] active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F0EDFC] mr-3">
                                    <Ionicons name="create-outline" size={20} color={PRIMARY_COLOR} />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#181A20]">Edit Class</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Code, title, schedule and venue</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            </Pressable>
                        )}

                        {canDeleteClass && (
                            <Pressable
                                onPress={() => { setMenuVisible(false); setDeleteVisible(true); }}
                                className="flex-row items-center py-4 active:opacity-70"
                            >
                                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FEECEC] mr-3">
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-medium text-[15px] text-[#EF4444]">Delete Class</Text>
                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5">Permanently remove this class</Text>
                                </View>
                            </Pressable>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Delete confirmation */}
            <Modal
                visible={deleteVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteVisible(false)}
            >
                <Pressable
                    className="flex-1 bg-black/50 items-center justify-center px-6"
                    onPress={() => !deleting && setDeleteVisible(false)}
                >
                    <Pressable onPress={(e) => e.stopPropagation()} className="w-full bg-white rounded-[24px] p-6">
                        <View className="items-center mb-4">
                            <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FEECEC] mb-3">
                                <Ionicons name="trash" size={26} color="#EF4444" />
                            </View>
                            <Text className="font-heading text-[18px] text-[#181A20] text-center">Delete {classInfo.code}?</Text>
                            <Text className="text-[14px] text-[#8F94A4] mt-2 text-center">
                                This permanently removes the class, its boundary and enrollments. This can't be undone.
                            </Text>
                        </View>
                        <View className="flex-row gap-3 mt-2">
                            <Pressable
                                onPress={() => setDeleteVisible(false)}
                                disabled={deleting}
                                className="flex-1 h-14 items-center justify-center rounded-[14px] bg-[#F1F2F6]"
                            >
                                <Text className="font-medium text-[16px] text-[#5A5D6B]">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleConfirmDelete}
                                disabled={deleting}
                                className="flex-1 h-14 items-center justify-center rounded-[14px] bg-[#EF4444]"
                                style={{ opacity: deleting ? 0.7 : 1 }}
                            >
                                {deleting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text className="font-medium text-[16px] text-white">Delete</Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
