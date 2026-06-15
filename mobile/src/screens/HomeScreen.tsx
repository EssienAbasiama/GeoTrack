import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, RefreshControl, ScrollView, Text, View, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import type { RootStackParamList } from "../types/navigation";
import { useRole } from "../store/RoleContext";
import { useAttendanceControl } from "../store/AttendanceControlContext";
import { AdminCreateBottomSheet, type AdminCreateBottomSheetRef } from "../components/AdminCreateBottomSheet";
import { dashboardApi, attendanceApi } from "../services/apiClient";
import { useAuth } from "../store/AuthContext";
import type { ApiStudentDashboard, ApiLecturerDashboard, ApiAdminDashboard, ApiSession, ApiCourse, ApiAttendanceRecord } from "../types/api";

const avatarSource = { uri: "https://randomuser.me/api/portraits/men/32.jpg" };

function useLiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

export function HomeScreen() {
    const now = useLiveClock();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isSuperAdmin, isStudent, isLecturer, isHOC, role } = useRole();
    const { isAttendanceEnabled, setAttendanceEnabled } = useAttendanceControl();
    const { user } = useAuth();
    const adminSheetRef = useRef<AdminCreateBottomSheetRef>(null);

    // --- Real dashboard data ---
    const [studentDash, setStudentDash] = useState<ApiStudentDashboard | null>(null);
    const [lecturerDash, setLecturerDash] = useState<ApiLecturerDashboard | null>(null);
    const [adminDash, setAdminDash] = useState<ApiAdminDashboard | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [myRecord, setMyRecord] = useState<ApiAttendanceRecord | null>(null);
    const [clockingOut, setClockingOut] = useState(false);

    const loadDashboards = async () => {
        try {
            if (isSuperAdmin) {
                const { data } = await dashboardApi.admin();
                setAdminDash(data);
            } else if (isLecturer || isHOC) {
                const { data } = await dashboardApi.lecturer();
                setLecturerDash(data);
            } else {
                const { data } = await dashboardApi.student();
                setStudentDash(data);
            }
        } catch {
            // Soft-fail: keep whatever is already shown.
        }
    };

    useEffect(() => {
        loadDashboards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSuperAdmin, isLecturer, isHOC]);

    // Refresh when the screen regains focus (e.g. after a class goes live).
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => { loadDashboards(); });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation, isSuperAdmin, isLecturer, isHOC]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboards();
        setRefreshing(false);
    };

    // --- Featured class on Home ---
    // A class is only "live"/"upcoming" based on a real active session or the
    // course's scheduled day/time window — never on faked fallback times.
    const featured = useMemo(() => {
        const activeSessions: ApiSession[] =
            (studentDash?.active_sessions ?? lecturerDash?.active_sessions ?? []) as ApiSession[];
        const candidates: ApiCourse[] = isStudent
            ? (studentDash?.upcoming_classes ?? [])
            : (lecturerDash?.courses ?? []);

        const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });
        const parseHM = (t?: string | null) => {
            if (!t) return null;
            const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            const ap = m[3]?.toLowerCase();
            if (ap === 'pm' && h !== 12) h += 12;
            if (ap === 'am' && h === 12) h = 0;
            return { h, min };
        };

        const statusOf = (course: ApiCourse) => {
            const session = activeSessions.find((s) => String(s.course_id) === String(course.id)) ?? null;
            let startDate: Date | null = null;
            let endDate: Date | null = null;
            if (session?.starts_at && session?.ends_at) {
                startDate = new Date(session.starts_at);
                endDate = new Date(session.ends_at);
            } else if (course.day === todayName) {
                const s = parseHM(course.start_time);
                const e = parseHM(course.end_time);
                if (s && e) {
                    startDate = new Date(now); startDate.setHours(s.h, s.min, 0, 0);
                    endDate = new Date(now); endDate.setHours(e.h, e.min, 0, 0);
                }
            }
            if (!startDate || !endDate) return { course, session, startDate: null, endDate: null, isLive: false, isUpcoming: false };
            const t = now.getTime();
            const isLive = t >= startDate.getTime() && t <= endDate.getTime();
            const isUpcoming = t < startDate.getTime() && startDate.getTime() - t <= 15 * 60 * 1000;
            return { course, session, startDate, endDate, isLive, isUpcoming };
        };

        const statuses = candidates.map(statusOf);
        // Prefer a class that is live right now, then one starting within 15 min.
        return statuses.find((s) => s.isLive) ?? statuses.find((s) => s.isUpcoming) ?? null;
    }, [studentDash, lecturerDash, isStudent, now]);

    const upcomingCourse = featured?.course ?? null;
    const fence = upcomingCourse?.geofence ?? null;
    const hasFence = Boolean(fence && fence.center_lat != null && fence.center_lng != null);
    const fenceCenter = hasFence
        ? { latitude: Number(fence!.center_lat), longitude: Number(fence!.center_lng) }
        : { latitude: 7.2266, longitude: 3.44 };

    const upcomingClass = upcomingCourse
        ? {
            id: upcomingCourse.id,
            code: upcomingCourse.code,
            name: upcomingCourse.title ?? upcomingCourse.name ?? '',
            venue: upcomingCourse.venue ?? '',
            day: upcomingCourse.day ?? '',
            location: fenceCenter,
            // Match ClassDetail: prefer the geofence label, then the venue text.
            locationName: fence?.name?.trim() || upcomingCourse.venue?.trim() || upcomingCourse.code,
            hasLocation: hasFence,
            polygonCoords: fence?.polygon ?? undefined,
        }
        : null;

    // Countdown derived from the featured class's real window.
    const getCountdown = () => {
        if (!featured || !featured.startDate) {
            return { minutes: 0, seconds: 0, isLive: false, canCheckIn: false };
        }
        const diff = featured.startDate.getTime() - now.getTime();
        const canCheckIn = featured.isLive || featured.isUpcoming;
        if (diff <= 0) return { minutes: 0, seconds: 0, isLive: featured.isLive, canCheckIn };
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return { minutes, seconds, isLive: featured.isLive, canCheckIn };
    };
    const countdown = getCountdown();
    const attendanceEnabled = upcomingClass ? isAttendanceEnabled(upcomingClass.code) : false;
    // Students and HOCs are class members who mark their own attendance, so they
    // can check in whenever the class is live (an active session exists). The
    // lecturer-side `attendanceEnabled` toggle only applies to lecturers.
    const canStudentCheckIn = countdown.canCheckIn && (isStudent || isHOC || attendanceEnabled);

    // ── Attendance record for the featured class (check-in / clock-out state) ──
    const isMember = isStudent || isHOC;
    const featuredSessionId = featured?.session?.id ?? null;

    const loadMyRecord = useCallback(async () => {
        if (!featuredSessionId || !isMember) { setMyRecord(null); return; }
        try {
            const { data } = await attendanceApi.myRecord(featuredSessionId);
            setMyRecord(data.record);
        } catch {
            setMyRecord(null);
        }
    }, [featuredSessionId, isMember]);

    useEffect(() => { loadMyRecord(); }, [loadMyRecord]);

    // Re-check the attendance record when returning to Home (e.g. after check-in).
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => { loadMyRecord(); });
        return unsubscribe;
    }, [navigation, loadMyRecord]);

    const hasCheckedIn = Boolean(myRecord?.checked_in_at);
    const hasCheckedOut = Boolean(myRecord?.checked_out_at);

    const fmtTime = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-- : --';
    const checkInLabel = fmtTime(myRecord?.checked_in_at);
    const checkOutLabel = fmtTime(myRecord?.checked_out_at);
    const totalLabel = (() => {
        if (!myRecord?.checked_in_at) return '00:00h';
        const end = myRecord.checked_out_at ? new Date(myRecord.checked_out_at) : now;
        const mins = Math.max(0, Math.floor((end.getTime() - new Date(myRecord.checked_in_at).getTime()) / 60000));
        return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}h`;
    })();

    // --- Screen fade animation ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    // --- Ripple Animations ---
    const rippleCount = 4;
    const rippleAnims = useRef(
        Array.from({ length: rippleCount }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        rippleAnims.forEach((anim, index) => {
            const animate = () => {
                Animated.sequence([
                    Animated.delay(index * 500),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 2500,
                        easing: Easing.out(Easing.exp),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]).start(() => animate());
            };
            animate();
        });
    }, []);

    const rippleStyle = (animatedValue: Animated.Value, size: number) => ({
        position: 'absolute' as const,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isSuperAdmin
            ? '#4CAF50'
            : isLecturer
                ? countdown.isLive
                    ? attendanceEnabled
                        ? '#EF4444'
                        : '#4CAF50'
                    : '#6755f2'
                : canStudentCheckIn
                    ? '#4CAF50'
                    : '#6755f2',
        opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 0],
        }),
        transform: [
            {
                scale: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1.8],
                }),
            },
        ],
    });

    const buttonScale = useRef(new Animated.Value(1)).current;

    const handleStudentCheckIn = () => {
        if (!upcomingClass) return;
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            navigation.navigate("CheckIn", {
                courseId: String(upcomingClass.id ?? ''),
                classCode: upcomingClass.code,
                className: upcomingClass.name,
            });
        });
    };

    const handleGetDirections = () => {
        if (!upcomingClass) return;
        if (!upcomingClass.hasLocation) {
            Toast.show({ type: 'info', text1: 'No location set for this class yet.', position: 'bottom' });
            return;
        }
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            // Same payload shape as the My Classes detail screen's directions.
            navigation.navigate("Navigation", {
                destination: upcomingClass.location,
                classCode: upcomingClass.code,
                className: upcomingClass.name,
                locationName: upcomingClass.locationName,
                polygonCoords: upcomingClass.polygonCoords,
            });
        });
    };

    const handleClockOut = async () => {
        if (!featuredSessionId || clockingOut) return;
        setClockingOut(true);
        try {
            const { data } = await attendanceApi.checkOut(featuredSessionId);
            setMyRecord(data.record);
            Toast.show({ type: 'success', text1: 'Clocked out. Have a great day!', position: 'bottom' });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not clock out.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setClockingOut(false);
        }
    };

    const handleStudentAction = () => {
        if (!upcomingClass) return;
        // Already checked in and still in session → clock out.
        if (hasCheckedIn && !hasCheckedOut) {
            handleClockOut();
            return;
        }
        if (hasCheckedOut) return; // done for this session
        if (canStudentCheckIn) {
            handleStudentCheckIn();
        } else {
            handleGetDirections();
        }
    };

    const handleLecturerAction = () => {
        if (!upcomingClass) return;
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            if (countdown.isLive) {
                setAttendanceEnabled(upcomingClass.code, !attendanceEnabled);
                return;
            }
            handleGetDirections();
        });
    };

    const handleAdminCreate = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => adminSheetRef.current?.open());
    };

    const formattedDate = useMemo(
        () =>
            now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                weekday: "long",
            }),
        [now]
    );

    const formattedTime = useMemo(
        () =>
            now.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
            }),
        [now]
    );

    const getRoleBadge = () => {
        const badges: Record<string, { label: string; color: string; bg: string }> = {
            student: { label: 'Student', color: '#6343cc', bg: '#F0EDFC' },
            lecturer: { label: 'Lecturer', color: '#2196F3', bg: '#E3F2FD' },
            hoc: { label: 'HOC', color: '#FF9800', bg: '#FFF3E0' },
            superadmin: { label: 'HOD', color: '#4CAF50', bg: '#E8F5E9' },
        };
        return badges[role] || badges.student;
    };
    const roleBadge = getRoleBadge();
    // No actionable class for a student/lecturer when nothing is in session.
    const noActiveClass = !isSuperAdmin && !upcomingClass;
    const isLecturerLive = isLecturer && countdown.isLive;
    // Member (student/HOC) attendance states for the featured class.
    const memberCheckedIn = isMember && hasCheckedIn && !hasCheckedOut;
    const memberDone = isMember && hasCheckedOut;
    const shouldShowDirections =
        !isSuperAdmin && !isLecturerLive && !memberCheckedIn && !memberDone &&
        ((isLecturer && !countdown.isLive) || !canStudentCheckIn);
    const mainButtonColor = noActiveClass
        ? '#C1C4CE'
        : memberDone
            ? '#4CAF50'
            : memberCheckedIn
                ? '#EF4444'
                : isSuperAdmin
                    ? '#4CAF50'
                    : isLecturerLive
                        ? attendanceEnabled
                            ? '#EF4444'
                            : '#4CAF50'
                        : shouldShowDirections
                            ? '#6343cc'
                            : '#4CAF50';

    const mainShadowColor = mainButtonColor;

    return (
        <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <Animated.View
                style={{
                    flex: 1,
                    opacity: fadeAnim,
                    transform: [
                        {
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                            }),
                        },
                    ],
                }}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 132 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6343cc" />
                    }
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Image source={avatarSource} className="h-12 w-12 rounded-full" resizeMode="cover" />
                            <View className="ml-3">
                                <View className="flex-row items-center">
                                    <Text className="font-sans text-[11px] text-[#A4A7B3]">Welcome back,</Text>
                                    <View
                                        className="ml-2 px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: roleBadge.bg }}
                                    >
                                        <Text
                                            className="text-[9px] font-medium"
                                            style={{ color: roleBadge.color }}
                                        >
                                            {roleBadge.label}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="font-heading text-[18px] leading-[20px] text-[#2D2F35]">{user?.name ?? 'Welcome'}</Text>
                            </View>
                        </View>
                        <View className="flex-row items-center gap-4">
                            <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-[#EEEAFD]">
                                <Ionicons name="notifications" size={16} color="#6343cc" />
                            </Pressable>
                            <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F6]">
                                <Feather name="menu" size={16} color="#8F93A3" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Date & Time */}
                    <View className="mt-8 items-center">
                        <Text className="font-medium text-[14px] text-[#4A4C55]">{formattedDate}</Text>
                        <Text className="mt-2 font-bold text-[42px] leading-[48px] text-[#17181D]">{formattedTime}</Text>
                    </View>

                    {/* Student View: Check-in Stats */}
                    {(isStudent || isLecturer || isHOC) && (
                        <View className="mt-5 rounded-[20px] border border-[#ECECF2] bg-[#F9F9FB] px-4 py-6">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-1 items-center">
                                    <Text className="font-sans text-[10px] text-[#C1C4CE]">Check in</Text>
                                    <Text
                                        className="mt-1 font-medium text-[14px]"
                                        style={{ color: hasCheckedIn ? '#4CAF50' : '#7E818D' }}
                                    >
                                        {checkInLabel}
                                    </Text>
                                </View>
                                <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                                <View className="flex-1 items-center">
                                    <Text className="font-sans text-[10px] text-[#C1C4CE]">Check Out</Text>
                                    <Text
                                        className="mt-1 font-medium text-[14px]"
                                        style={{ color: hasCheckedOut ? '#EF4444' : '#7E818D' }}
                                    >
                                        {checkOutLabel}
                                    </Text>
                                </View>
                                <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                                <View className="flex-1 items-center">
                                    <Text className="font-sans text-[10px] text-[#C1C4CE]">Total hour</Text>
                                    <Text className="mt-1 font-heading text-[18px] text-[#2E3036]">{totalLabel}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Super Admin View: Quick Stats */}
                    {isSuperAdmin && (
                        <View className="mt-5 flex-row gap-3">
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5E9] mb-2">
                                    <Ionicons name="book" size={18} color="#4CAF50" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">{adminDash?.counts?.courses ?? '--'}</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Classes</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] mb-2">
                                    <Ionicons name="people" size={18} color="#2196F3" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">{adminDash?.counts?.lecturers ?? '--'}</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Lecturers</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F0EDFC] mb-2">
                                    <Ionicons name="school" size={18} color="#6343cc" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">{adminDash?.counts?.students ?? '--'}</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Students</Text>
                            </View>
                        </View>
                    )}

                    {/* Student: Upcoming Class with Countdown */}
                    {(isStudent || isLecturer || isHOC) && (
                        upcomingClass ? (
                            <View className="mt-4 rounded-[16px] bg-white px-4 py-4 shadow-sm shadow-black/5">
                                <View className="flex-row items-center">
                                    <View className="h-10 w-10 items-center justify-center rounded-[12px] bg-[#F0EDFC]">
                                        <Ionicons name="book" size={18} color="#6343cc" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-heading text-[16px] text-[#181A20]">{upcomingClass.code}</Text>
                                        <Text className="text-[12px] text-[#8F94A4]">
                                            {upcomingClass.venue || upcomingClass.name}
                                        </Text>
                                    </View>
                                    <View className="items-end">
                                        {countdown.isLive ? (
                                            <View className="flex-row items-center">
                                                <View className="h-2 w-2 rounded-full bg-[#4CAF50] mr-1.5" />
                                                <Text className="font-heading text-[16px] text-[#4CAF50]">LIVE</Text>
                                            </View>
                                        ) : (
                                            <>
                                                <Text className="text-[10px] text-[#8F94A4]">Starts in</Text>
                                                <Text className="font-heading text-[18px] text-[#6343cc]">
                                                    {countdown.minutes}:{countdown.seconds.toString().padStart(2, '0')}
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View className="mt-4 rounded-[16px] bg-white px-4 py-5 shadow-sm shadow-black/5 items-center">
                                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F1F2F6] mb-2">
                                    <Ionicons name="calendar-outline" size={22} color="#B8BBC6" />
                                </View>
                                <Text className="font-heading text-[15px] text-[#181A20]">No class in session</Text>
                                <Text className="text-[12px] text-[#8F94A4] mt-1 text-center">
                                    {isStudent
                                        ? 'A class will appear here when one of your enrolled classes goes live.'
                                        : 'Your active class will appear here once a session starts.'}
                                </Text>
                            </View>
                        )
                    )}

                    {/* Super Admin: Recent Activity */}
                    {isSuperAdmin && (
                        <View className="mt-4 rounded-[16px] bg-white px-4 py-4 shadow-sm shadow-black/5">
                            <Text className="font-heading text-[14px] text-[#181A20] mb-3">Recent Activity</Text>
                            <View className="flex-row items-center mb-3">
                                <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E8F5E9]">
                                    <Ionicons name="checkmark" size={14} color="#4CAF50" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-[13px] text-[#5A5D6B]">ELE 512 class created</Text>
                                    <Text className="text-[11px] text-[#B8BBC6]">2 hours ago</Text>
                                </View>
                            </View>
                            <View className="flex-row items-center">
                                <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E3F2FD]">
                                    <Ionicons name="person-add" size={14} color="#2196F3" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-[13px] text-[#5A5D6B]">Dr. Johnson assigned to ELE 514</Text>
                                    <Text className="text-[11px] text-[#B8BBC6]">Yesterday</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Main Action Button with Ripples */}
                    <View className="mt-8 items-center">
                        <View className="relative h-[220px] w-[220px] items-center justify-center">
                            {!noActiveClass && rippleAnims.map((anim, idx) => (
                                <Animated.View
                                    key={idx}
                                    style={rippleStyle(anim, 130 + idx * 30)}
                                />
                            ))}

                            <Pressable
                                disabled={noActiveClass}
                                onPress={
                                    isSuperAdmin
                                        ? handleAdminCreate
                                        : isLecturer
                                            ? handleLecturerAction
                                            : handleStudentAction
                                }
                            >
                                <Animated.View
                                    style={{
                                        width: 130,
                                        height: 130,
                                        borderRadius: 65,
                                        backgroundColor: mainButtonColor,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        transform: [{ scale: buttonScale }],
                                        shadowColor: mainShadowColor,
                                        shadowOpacity: 0.4,
                                        shadowRadius: 20,
                                        shadowOffset: { width: 0, height: 8 },
                                        elevation: 12,
                                    }}
                                >
                                    {noActiveClass ? (
                                        <>
                                            <MaterialCommunityIcons name="clock-outline" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[13px] text-white text-center px-2">
                                                No Active Class
                                            </Text>
                                        </>
                                    ) : memberDone ? (
                                        <>
                                            <Ionicons name="checkmark-done" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[14px] text-white text-center px-2">
                                                Checked Out
                                            </Text>
                                        </>
                                    ) : memberCheckedIn ? (
                                        <>
                                            <MaterialCommunityIcons name="logout" size={30} color="#fff" />
                                            <Text className="mt-2 font-heading text-[15px] text-white">
                                                {clockingOut ? 'Clocking…' : 'Clock Out'}
                                            </Text>
                                        </>
                                    ) : isSuperAdmin ? (
                                        <>
                                            <Ionicons name="add" size={42} color="#fff" />
                                            <Text className="mt-1 font-heading text-[14px] text-white">
                                                Create
                                            </Text>
                                        </>
                                    ) : isLecturerLive ? (
                                        <>
                                            <MaterialCommunityIcons
                                                name={attendanceEnabled ? 'account-cancel' : 'account-check'}
                                                size={32}
                                                color="#fff"
                                            />
                                            <Text className="mt-2 font-heading text-[14px] text-white text-center px-2">
                                                {attendanceEnabled ? 'Disable Attendance' : 'Allow Attendance'}
                                            </Text>
                                        </>
                                    ) : shouldShowDirections ? (
                                        <>
                                            <MaterialIcons name="directions" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[14px] text-white">
                                                Directions
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="account-check" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[16px] text-white">
                                                Clock In
                                            </Text>
                                        </>
                                    )}
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>

            {/* Admin Create Bottom Sheet */}
            <AdminCreateBottomSheet ref={adminSheetRef} />
        </SafeAreaView>
    );
}