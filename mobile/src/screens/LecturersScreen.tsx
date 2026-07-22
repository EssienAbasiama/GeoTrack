import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useEffect, useRef, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, Text, TextInput, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminCreateBottomSheet, type AdminCreateBottomSheetRef } from '../components/AdminCreateBottomSheet';
import { lecturerApi } from '../services/apiClient';
import type { ApiLecturer } from '../types/api';

const PRIMARY_COLOR = '#6343cc';

interface LecturerClass {
    id: string;
    code: string;
    color: string;
}

interface Lecturer {
    id: string;
    name: string;
    email: string;
    department: string;
    avatar: string;
    classes: LecturerClass[];
    totalStudents: number;
}

// Class tag colors - each class gets a consistent color
const CLASS_COLORS = [
    '#6343cc', // Purple
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#9C27B0', // Deep Purple
    '#F44336', // Red
];

// Mock data for lecturers
const MOCK_LECTURERS: Lecturer[] = [
    {
        id: '1',
        name: 'Dr. Adewale Johnson',
        email: 'a.johnson@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        classes: [
            { id: '1', code: 'ELE 512', color: CLASS_COLORS[0] },
            { id: '6', code: 'ELE 522', color: CLASS_COLORS[5] },
        ],
        totalStudents: 89,
    },
    {
        id: '2',
        name: 'Prof. Emeka Okafor',
        email: 'e.okafor@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
        classes: [
            { id: '2', code: 'ELE 514', color: CLASS_COLORS[1] },
        ],
        totalStudents: 52,
    },
    {
        id: '3',
        name: 'Dr. Funke Adeyemi',
        email: 'f.adeyemi@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
        classes: [
            { id: '3', code: 'ELE 516', color: CLASS_COLORS[2] },
            { id: '7', code: 'ELE 524', color: CLASS_COLORS[6] },
            { id: '9', code: 'ELE 530', color: CLASS_COLORS[3] },
        ],
        totalStudents: 124,
    },
    {
        id: '4',
        name: 'Dr. Ibrahim Musa',
        email: 'i.musa@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
        classes: [
            { id: '4', code: 'ELE 518', color: CLASS_COLORS[3] },
        ],
        totalStudents: 41,
    },
    {
        id: '5',
        name: 'Prof. Chidinma Eze',
        email: 'c.eze@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/women/52.jpg',
        classes: [
            { id: '5', code: 'ELE 520', color: CLASS_COLORS[4] },
            { id: '8', code: 'ELE 528', color: CLASS_COLORS[7] },
        ],
        totalStudents: 96,
    },
    {
        id: '6',
        name: 'Dr. Ngozi Okwu',
        email: 'n.okwu@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/women/33.jpg',
        classes: [],
        totalStudents: 0,
    },
    {
        id: '7',
        name: 'Prof. Tunde Bakare',
        email: 't.bakare@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/men/58.jpg',
        classes: [
            { id: '10', code: 'ELE 532', color: CLASS_COLORS[5] },
            { id: '11', code: 'ELE 534', color: CLASS_COLORS[0] },
            { id: '12', code: 'ELE 536', color: CLASS_COLORS[1] },
        ],
        totalStudents: 135,
    },
    {
        id: '8',
        name: 'Dr. Kemi Afolabi',
        email: 'k.afolabi@unilag.edu.ng',
        department: 'Electrical Engineering',
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        classes: [
            { id: '13', code: 'ELE 538', color: CLASS_COLORS[2] },
        ],
        totalStudents: 48,
    },
];

function ClassTag({ code, color }: { code: string; color: string }) {
    return (
        <View
            className="mr-1.5 mb-1.5 px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${color}15` }}
        >
            <Text
                className="text-[11px] font-medium"
                style={{ color }}
            >
                {code}
            </Text>
        </View>
    );
}

function LecturerCard({ item, index }: { item: Lecturer; index: number }) {
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

    return (
        <Animated.View
            style={{
                opacity: scaleAnim,
                transform: [
                    { translateY },
                    {
                        scale: scaleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1],
                        }),
                    },
                ],
            }}
        >
            <Pressable className="mb-4 rounded-[20px] bg-white p-4 shadow-sm shadow-black/5">
                {/* Header with Avatar and Name */}
                <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                        <Image
                            source={{ uri: item.avatar }}
                            className="h-14 w-14 rounded-full"
                            resizeMode="cover"
                        />
                        <View className="ml-3 flex-1">
                            <View className="flex-row items-center">
                                <Text className="font-heading text-[17px] text-[#181A20]">{item.name}</Text>
                                <View
                                    className="ml-2 px-3 py-1 rounded-full"
                                    style={{
                                        backgroundColor: item.classes.length > 0 ? '#E8F5E9' : '#FFF3E0',
                                    }}
                                >
                                    <Text
                                        className="text-[12px] font-medium"
                                        style={{
                                            color: item.classes.length > 0 ? '#4CAF50' : '#FF9800',
                                        }}
                                    >
                                        {item.classes.length > 0 ? 'Assigned' : 'Unassigned'}
                                    </Text>
                                </View>
                            </View>
                            <Text className="text-[12px] text-[#8F94A4] mt-0.5">{item.email}</Text>
                        </View>
                    </View>
                    <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-[#F5F6FA]">
                        <Ionicons name="ellipsis-horizontal" size={16} color="#8F94A4" />
                    </Pressable>
                </View>

                {/* Class Tags */}
                {item.classes.length > 0 ? (
                    <View className="flex-row flex-wrap mt-2">
                        {item.classes.map((cls) => (
                            <ClassTag key={cls.id} code={cls.code} color={cls.color} />
                        ))}
                    </View>
                ) : (
                    <View className="mt-2 flex-row items-center">
                        <View className="h-6 w-6 items-center justify-center rounded-full bg-[#FFF3E0]">
                            <Ionicons name="alert" size={12} color="#FF9800" />
                        </View>
                        <Text className="ml-2 text-[12px] text-[#B8BBC6] italic">
                            No classes assigned
                        </Text>
                    </View>
                )}

                {/* Footer Stats */}
                <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-[#F0F1F5]">
                    <View className="flex-row items-center">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#F0EDFC]">
                            <Ionicons name="book" size={14} color={PRIMARY_COLOR} />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]">
                            {item.classes.length} {item.classes.length === 1 ? 'Class' : 'Classes'}
                        </Text>
                    </View>
                    <View className="flex-row items-center">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#E8F5E9]">
                            <Ionicons name="people" size={14} color="#4CAF50" />
                        </View>
                        <Text className="ml-2 text-[13px] text-[#5A5D6B]">
                            {item.totalStudents} Students
                        </Text>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

function apiLecturerToLocal(l: ApiLecturer, idx: number): Lecturer {
    const classes: LecturerClass[] = (l.assigned_courses ?? []).map((c, i) => ({
        id: String(c.id),
        code: c.code,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
    }));
    return {
        id: String(l.id),
        name: l.name,
        email: l.email,
        department: l.department ?? '',
        avatar: l.avatar_url ?? `https://randomuser.me/api/portraits/${idx % 2 === 0 ? 'men' : 'women'}/${idx + 20}.jpg`,
        classes,
        totalStudents: l.total_students ?? 0,
    };
}

export function LecturersScreen() {
    const headerAnim = useRef(new Animated.Value(0)).current;
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchAnim = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);
    const fabBounce = useRef(new Animated.Value(1)).current;
    const createSheetRef = useRef<AdminCreateBottomSheetRef>(null);

    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadLecturers = async () => {
        try {
            const { data } = await lecturerApi.list();
            setLecturers((data.lecturers ?? []).map(apiLecturerToLocal));
            setLoadError(null);
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Failed to load lecturers.';
            setLoadError(msg);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            await loadLecturers();
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLecturers();
        setRefreshing(false);
    };

    useEffect(() => {
        Animated.timing(headerAnim, {
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

    // Always show real data — never fall back to MOCK_LECTURERS, which would
    // display invented staff that don't exist on the server.
    const source = lecturers;
    const totalLecturers = source.length;
    const assignedLecturers = source.filter((l) => l.classes.length > 0).length;

    const filteredLecturers = useMemo(() => {
        if (!searchQuery.trim()) return source;
        const q = searchQuery.toLowerCase();
        return source.filter(
            (l) =>
                l.name.toLowerCase().includes(q) ||
                l.email.toLowerCase().includes(q) ||
                l.classes.some((c) => c.code.toLowerCase().includes(q))
        );
    }, [searchQuery, source]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <FlatList
                data={filteredLecturers}
                keyExtractor={(item) => item.id}
                contentContainerClassName="px-5 pt-3 pb-[140px]"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY_COLOR} />
                }
                ListEmptyComponent={
                    loading ? (
                        <View className="items-center py-10">
                            <ActivityIndicator color={PRIMARY_COLOR} />
                        </View>
                    ) : (
                        <View className="items-center py-10 px-6">
                            <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                <Ionicons name="people" size={28} color={PRIMARY_COLOR} />
                            </View>
                            <Text className="font-medium text-[15px] text-[#181A20] text-center">
                                No lecturers found
                            </Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                {loadError ?? 'Pull down to refresh.'}
                            </Text>
                        </View>
                    )
                }
                ListHeaderComponent={
                    <Animated.View
                        style={{
                            opacity: headerAnim,
                            transform: [
                                {
                                    translateY: headerAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-10, 0],
                                    }),
                                },
                            ],
                        }}
                    >
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Text className="font-heading text-[26px] text-[#181A20]">Lecturers</Text>
                                <Text className="text-[14px] text-[#8F94A4] mt-1">
                                    {assignedLecturers} of {totalLecturers} assigned to classes
                                </Text>
                            </View>
                            <Pressable
                                onPress={toggleSearch}
                                className="h-10 w-10 items-center justify-center rounded-full bg-[#F0EDFC]"
                            >
                                <Ionicons name={searchVisible ? 'close' : 'search'} size={18} color={PRIMARY_COLOR} />
                            </Pressable>
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
                                    marginBottom: 12,
                                    overflow: 'hidden',
                                }}
                            >
                                <View className="flex-row items-center h-[48px] rounded-[14px] bg-white border border-[#E8EAF1] px-4">
                                    <Feather name="search" size={16} color="#8F94A4" />
                                    <TextInput
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Search lecturers or class codes..."
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

                        {/* Summary Stats */}
                        <View className="flex-row gap-3 mb-6">
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] mb-2">
                                    <Ionicons name="people" size={18} color="#2196F3" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">{totalLecturers}</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Total Lecturers</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5E9] mb-2">
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">{assignedLecturers}</Text>
                                <Text className="text-[12px] text-[#8F94A4]">Assigned</Text>
                            </View>
                            <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#FFF3E0] mb-2">
                                    <Ionicons name="alert-circle" size={18} color="#FF9800" />
                                </View>
                                <Text className="font-heading text-[22px] text-[#181A20]">
                                    {totalLecturers - assignedLecturers}
                                </Text>
                                <Text className="text-[12px] text-[#8F94A4]">Unassigned</Text>
                            </View>
                        </View>
                    </Animated.View>
                }
                renderItem={({ item, index }) => <LecturerCard item={item} index={index} />}
            />

            {/* Floating Action Button */}
            <Pressable
                onPress={() => createSheetRef.current?.open('lecturer')}
                style={{ position: 'absolute', bottom: 100, right: 20 }}
            >
                <Animated.View
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: '#4CAF50',
                        justifyContent: 'center',
                        alignItems: 'center',
                        transform: [{ scale: fabBounce }],
                        shadowColor: '#4CAF50',
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: 8,
                    }}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </Animated.View>
            </Pressable>

            <AdminCreateBottomSheet ref={createSheetRef} />
        </SafeAreaView>
    );
}
