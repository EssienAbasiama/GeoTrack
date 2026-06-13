import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRole } from '../store/RoleContext';
import { AdminCreateBottomSheet, type AdminCreateBottomSheetRef } from '../components/AdminCreateBottomSheet';
import type { ClassEntity } from '../types/roles';
import type { RootStackParamList } from '../types/navigation';
import { courseApi } from '../services/apiClient';
import type { ApiCourse } from '../types/api';

const PRIMARY_COLOR = '#6343cc';

// Helper to get current day name
const getCurrentDay = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

// Helper to get current time formatted for testing (class active now)
const getActiveClassTime = () => {
    const now = new Date();
    const startHour = now.getHours();
    const endHour = startHour + 2;
    return {
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
    };
};

// Mock data for classes
// First class is set to be ACTIVE TODAY for testing
const MOCK_CLASSES: ClassEntity[] = [
    {
        id: '1',
        code: 'ELE 512',
        name: 'Digital Signal Processing',
        venue: 'LT 201',
        day: getCurrentDay(), // Today - makes it active
        ...getActiveClassTime(), // Current time - makes it active now
        lecturerName: 'Dr. Adewale Johnson',
        totalStudents: 45,
        attendanceRate: 87,
    },
    {
        id: '2',
        code: 'ELE 514',
        name: 'Control Systems Engineering',
        venue: 'LT 105',
        day: 'Tuesday',
        startTime: '14:00',
        endTime: '16:00',
        lecturerName: 'Prof. Emeka Okafor',
        totalStudents: 52,
        attendanceRate: 92,
    },
    {
        id: '3',
        code: 'ELE 516',
        name: 'Power Electronics',
        venue: 'Lab 3',
        day: 'Wednesday',
        startTime: '10:00',
        endTime: '12:00',
        lecturerName: 'Dr. Funke Adeyemi',
        totalStudents: 38,
        attendanceRate: 78,
    },
    {
        id: '4',
        code: 'ELE 518',
        name: 'Embedded Systems Design',
        venue: 'Lab 1',
        day: 'Thursday',
        startTime: '08:00',
        endTime: '10:00',
        lecturerName: 'Dr. Ibrahim Musa',
        totalStudents: 41,
        attendanceRate: 95,
    },
    {
        id: '5',
        code: 'ELE 520',
        name: 'Communication Systems',
        venue: 'LT 302',
        day: 'Friday',
        startTime: '13:00',
        endTime: '15:00',
        lecturerName: 'Prof. Chidinma Eze',
        totalStudents: 48,
        attendanceRate: 83,
    },
];

function ClassCard({ item, index, onPress }: { item: ClassEntity; index: number; onPress?: () => void }) {
    const { isSuperAdmin } = useRole();
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay: index * 80,
                useNativeDriver: true,
                speed: 14,
                bounciness: 4,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                delay: index * 80,
                duration: 400,
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
                transform: [{ translateY }, {
                    scale: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                    })
                }],
            }}
        >
            <Pressable
                onPress={onPress}
                className="mb-4 rounded-[20px] bg-white p-4 shadow-sm shadow-black/5 active:opacity-90"
            >
                {/* Header */}
                <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                        <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-[#F0EDFC]">
                            <Ionicons name="book" size={22} color={PRIMARY_COLOR} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">{item.code}</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-0.5" numberOfLines={1}>
                                {item.name}
                            </Text>
                        </View>
                    </View>
                    <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-[#F5F6FA]">
                        <Ionicons name="ellipsis-horizontal" size={16} color="#8F94A4" />
                    </Pressable>
                </View>

                {/* Details Grid */}
                <View className="flex-row flex-wrap mt-2">
                    <View className="w-1/2 flex-row items-center mb-3 pr-2">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#E8F5E9]">
                            <Ionicons name="location" size={14} color="#4CAF50" />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]" numberOfLines={1}>
                            {item.venue || 'No location'}
                        </Text>
                    </View>
                    <View className="w-1/2 flex-row items-center mb-3 pl-2">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#FFF3E0]">
                            <Ionicons name="calendar" size={14} color="#FF9800" />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]">{item.day}</Text>
                    </View>
                    <View className="w-1/2 flex-row items-center pr-2">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#E3F2FD]">
                            <Ionicons name="time" size={14} color="#2196F3" />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]">
                            {item.startTime} - {item.endTime}
                        </Text>
                    </View>
                    <View className="w-1/2 flex-row items-center pl-2">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#FCE4EC]">
                            <Ionicons name="people" size={14} color="#E91E63" />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]">{item.totalStudents} students</Text>
                    </View>
                </View>

                {/* Lecturer & Attendance */}
                <View className="mt-4 pt-4 border-t border-[#F1F2F6]">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#F5F6FA]">
                                <Ionicons name="person" size={14} color="#8F94A4" />
                            </View>
                            <Text className="ml-2 text-[13px] text-[#5A5D6B] flex-1" numberOfLines={1}>
                                {item.lecturerName}
                            </Text>
                        </View>
                        {isSuperAdmin && item.attendanceRate && (
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
                        )}
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

function apiCourseToClassEntity(c: ApiCourse): ClassEntity {
    return {
        id: String(c.id),
        code: c.code,
        name: c.title ?? c.name ?? '',
        // Fall back to the geofence label when no venue text was typed
        // (classes whose location was set by drawing a boundary).
        venue: c.venue?.trim() || c.geofence?.name?.trim() || '',
        day: c.day ?? '',
        startTime: c.start_time ?? '',
        endTime: c.end_time ?? '',
        lecturerName: c.lecturer?.name ?? c.lecturer_name ?? '',
        lecturerId: c.lecturer_id != null ? String(c.lecturer_id) : undefined,
        totalStudents: c.total_students,
        attendanceRate: c.attendance_rate ?? undefined,
    };
}

export function ClassesScreen() {
    const { isSuperAdmin, isHOC, isLecturer, role } = useRole();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchAnim = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);
    const fabBounce = useRef(new Animated.Value(1)).current;
    const createSheetRef = useRef<AdminCreateBottomSheetRef>(null);

    const [classes, setClasses] = useState<ClassEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadClasses = async () => {
        try {
            const { data } = await courseApi.list();
            setClasses((data.courses ?? []).map(apiCourseToClassEntity));
            setLoadError(null);
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Failed to load classes.';
            setLoadError(msg);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            await loadClasses();
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Start bouncing animation for FAB
        const bounceLoop = () => {
            Animated.sequence([
                Animated.timing(fabBounce, {
                    toValue: 1.12,
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
            ]).start(() => bounceLoop());
        };
        bounceLoop();
    }, []);

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

    const listSource = classes.length === 0 && loadError ? MOCK_CLASSES : classes;
    const headerTitle = isSuperAdmin ? 'All Classes' : 'My Classes';
    const headerSubtitle = isSuperAdmin
        ? `${listSource.length} classes in department`
        : 'Your enrolled classes';

    const filteredClasses = useMemo(() => {
        if (!searchQuery.trim()) return listSource;
        const q = searchQuery.toLowerCase();
        return listSource.filter(
            (c) =>
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                (c.lecturerName ?? '').toLowerCase().includes(q) ||
                c.venue.toLowerCase().includes(q)
        );
    }, [searchQuery, listSource]);

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
                                outputRange: [16, 0],
                            }),
                        },
                    ],
                }}
            >
                {/* Header */}
                <View className="px-5 pt-3 pb-4">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="font-heading text-[26px] text-[#181A20]">{headerTitle}</Text>
                            <Text className="text-[14px] text-[#8F94A4] mt-1">{headerSubtitle}</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <Pressable
                                onPress={toggleSearch}
                                className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
                            >
                                <Feather name={searchVisible ? 'x' : 'search'} size={18} color="#5A5D6B" />
                            </Pressable>
                            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5">
                                <Feather name="filter" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Search Bar */}
                    {searchVisible && (
                        <Animated.View
                            style={{
                                opacity: searchAnim,
                                maxHeight: searchAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 56],
                                }),
                                marginTop: 12,
                                overflow: 'hidden',
                            }}
                        >
                            <View className="flex-row items-center h-[48px] rounded-[14px] bg-white border border-[#E8EAF1] px-4">
                                <Feather name="search" size={16} color="#8F94A4" />
                                <TextInput
                                    ref={searchInputRef}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search classes, lecturers, venues..."
                                    placeholderTextColor="#B8BBC6"
                                    className="flex-1 ml-3 text-[14px] text-[#181A20]"
                                    returnKeyType="search"
                                />
                                {searchQuery.length > 0 && (
                                    <Pressable onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#B8BBC6" />
                                    </Pressable>
                                )}
                            </View>
                        </Animated.View>
                    )}

                    {/* Stats Summary (Super Admin Only) */}
                    {isSuperAdmin && (
                        <View className="mt-5 flex-row gap-3">
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5E9] mb-2">
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">87%</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Avg. Attendance</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] mb-2">
                                    <Ionicons name="people" size={18} color="#2196F3" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">224</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Total Students</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#FFF3E0] mb-2">
                                    <Ionicons name="school" size={18} color="#FF9800" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">8</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Lecturers</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Class List */}
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={PRIMARY_COLOR} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredClasses}
                        keyExtractor={(item) => item.id}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY_COLOR} />
                        }
                        ListEmptyComponent={
                            <View className="items-center py-10 px-6">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                    <Ionicons name="book" size={28} color={PRIMARY_COLOR} />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20] text-center">
                                    {loadError ? 'Showing cached data' : 'No classes yet'}
                                </Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                    {loadError ?? 'Pull down to refresh once the backend is reachable.'}
                                </Text>
                            </View>
                        }
                        renderItem={({ item, index }) => (
                            <ClassCard
                                item={item}
                                index={index}
                                onPress={() => {
                                    navigation.navigate('ClassDetail', {
                                        classId: item.id,
                                        classCode: item.code,
                                        className: item.name,
                                        venue: item.venue,
                                        day: item.day,
                                        startTime: item.startTime,
                                        endTime: item.endTime,
                                    });
                                }}
                            />
                        )}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </Animated.View>

            {/* Floating Action Button - HOC, SuperAdmin and Lecturers can create classes */}
            {(isHOC || isSuperAdmin || isLecturer) && (
                <Pressable
                    onPress={() => createSheetRef.current?.open(isLecturer ? 'class' : 'select')}
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
                        <Ionicons name="add" size={32} color="#fff" />
                    </Animated.View>
                </Pressable>
            )}

            <AdminCreateBottomSheet ref={createSheetRef} onSuccess={loadClasses} />
        </SafeAreaView>
    );
}
