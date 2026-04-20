import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types/navigation";
import { useRole } from "../store/RoleContext";
import { AdminCreateBottomSheet, type AdminCreateBottomSheetRef } from "../components/AdminCreateBottomSheet";

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
    const adminSheetRef = useRef<AdminCreateBottomSheetRef>(null);

    // --- Mock upcoming class data ---
    // Using FUNAAB (Federal University of Agriculture, Abeokuta) coordinates for testing
    // Class is set to be ACTIVE NOW for testing liveness check flow
    const upcomingClass = {
        code: 'ELE 512',
        name: 'Digital Signal Processing',
        venue: 'LT 201',
        day: new Date().toLocaleDateString('en-US', { weekday: 'long' }), // Today
        startTime: new Date(now.getTime() - 30 * 60 * 1000), // Started 30 mins ago (ACTIVE)
        endTime: new Date(now.getTime() + 90 * 60 * 1000), // Ends in 1.5 hours
        location: {
            latitude: 7.2266,
            longitude: 3.4400,
        },
    };

    // Calculate countdown and determine if class is currently active
    const getCountdown = () => {
        const diff = upcomingClass.startTime.getTime() - now.getTime();
        const endDiff = upcomingClass.endTime.getTime() - now.getTime();

        // Class is live if: started (diff <= 0) AND not ended (endDiff > 0)
        const isLive = diff <= 0 && endDiff > 0;

        // Class is upcoming if: starts within 15 mins (can check in early)
        const isUpcoming = diff > 0 && diff <= 15 * 60 * 1000;

        // Can check in if class is live OR upcoming (within 15 min grace period)
        const canCheckIn = isLive || isUpcoming;

        if (diff <= 0) return { minutes: 0, seconds: 0, isLive, canCheckIn };
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return { minutes, seconds, isLive, canCheckIn };
    };
    const countdown = getCountdown();

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
            : countdown.canCheckIn
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
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => navigation.navigate("CheckIn"));
    };

    const handleGetDirections = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            // Navigate to navigation screen with class location
            navigation.navigate("Navigation", {
                destination: upcomingClass.location,
                classCode: upcomingClass.code,
                className: upcomingClass.name,
                locationName: upcomingClass.venue,
            });
        });
    };

    const handleStudentAction = () => {
        if (countdown.canCheckIn) {
            handleStudentCheckIn();
        } else {
            handleGetDirections();
        }
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
                <View className="flex-1 pb-[132px]">
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
                                <Text className="font-heading text-[18px] leading-[20px] text-[#2D2F35]">Essien Abasiama</Text>
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
                                    <Text className="mt-1 font-medium text-[14px] text-[#7E818D]">-- : --</Text>
                                </View>
                                <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                                <View className="flex-1 items-center">
                                    <Text className="font-sans text-[10px] text-[#C1C4CE]">Check Out</Text>
                                    <Text className="mt-1 font-medium text-[14px] text-[#7E818D]">-- : --</Text>
                                </View>
                                <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                                <View className="flex-1 items-center">
                                    <Text className="font-sans text-[10px] text-[#C1C4CE]">Total hour</Text>
                                    <Text className="mt-1 font-heading text-[18px] text-[#2E3036]">00:00h</Text>
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
                                <Text className="font-heading text-[22px] text-[#181A20]">12</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Classes</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] mb-2">
                                    <Ionicons name="people" size={18} color="#2196F3" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">8</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Lecturers</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F0EDFC] mb-2">
                                    <Ionicons name="school" size={18} color="#6343cc" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">224</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Students</Text>
                            </View>
                        </View>
                    )}

                    {/* Student: Upcoming Class with Countdown */}
                    {(isStudent || isLecturer || isHOC) && (
                        <View className="mt-4 rounded-[16px] bg-white px-4 py-4 shadow-sm shadow-black/5">
                            <View className="flex-row items-center">
                                <View className="h-10 w-10 items-center justify-center rounded-[12px] bg-[#F0EDFC]">
                                    <Ionicons name="book" size={18} color="#6343cc" />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="font-heading text-[16px] text-[#181A20]">{upcomingClass.code}</Text>
                                    <Text className="text-[12px] text-[#8F94A4]">{upcomingClass.venue}</Text>
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
                            {rippleAnims.map((anim, idx) => (
                                <Animated.View
                                    key={idx}
                                    style={rippleStyle(anim, 130 + idx * 30)}
                                />
                            ))}

                            <Pressable onPress={isSuperAdmin ? handleAdminCreate : handleStudentAction}>
                                <Animated.View
                                    style={{
                                        width: 130,
                                        height: 130,
                                        borderRadius: 65,
                                        backgroundColor: isSuperAdmin
                                            ? '#4CAF50'
                                            : countdown.canCheckIn
                                                ? '#4CAF50'
                                                : '#6343cc',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        transform: [{ scale: buttonScale }],
                                        shadowColor: isSuperAdmin
                                            ? '#4CAF50'
                                            : countdown.canCheckIn
                                                ? '#4CAF50'
                                                : '#6343cc',
                                        shadowOpacity: 0.4,
                                        shadowRadius: 20,
                                        shadowOffset: { width: 0, height: 8 },
                                        elevation: 12,
                                    }}
                                >
                                    {isSuperAdmin ? (
                                        <>
                                            <Ionicons name="add" size={42} color="#fff" />
                                            <Text className="mt-1 font-heading text-[14px] text-white">
                                                Create
                                            </Text>
                                        </>
                                    ) : countdown.canCheckIn ? (
                                        <>
                                            <MaterialCommunityIcons name="account-check" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[16px] text-white">
                                                Clock In
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <MaterialIcons name="directions" size={32} color="#fff" />
                                            <Text className="mt-2 font-heading text-[14px] text-white">
                                                Directions
                                            </Text>
                                        </>
                                    )}
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Animated.View>

            {/* Admin Create Bottom Sheet */}
            <AdminCreateBottomSheet ref={adminSheetRef} />
        </SafeAreaView>
    );
}