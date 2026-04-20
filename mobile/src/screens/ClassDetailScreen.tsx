import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Animated, Easing, FlatList, Pressable, Text, TextInput, View, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useRole } from '../store/RoleContext';
import { AddStudentBottomSheet, type AddStudentBottomSheetRef } from '../components/AddStudentBottomSheet';
import { SetLocationBottomSheet, type SetLocationBottomSheetRef } from '../components/SetLocationBottomSheet';
import { LocationCheckBottomSheet, type LocationCheckBottomSheetRef } from '../components/LocationCheckBottomSheet';
import { celebrationPattern } from '../utils/haptics';
import { notifyCheckInSuccess } from '../services/notifications';

const PRIMARY_COLOR = '#6343cc';
const PRIMARY_LIGHT = '#8B6FE8'; // Lighter shade for lecturer/HOC

interface Student {
    id: string;
    name: string;
    matricNo: string;
    email: string;
    avatar: string;
    attendanceRate: number;
}

// Mock lecturer data
const MOCK_LECTURER = {
    id: 'lec1',
    name: 'Dr. Adewale Johnson',
    email: 'adewale.johnson@lecturer.edu.ng',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    department: 'Electrical Engineering',
};

// Mock students data
const MOCK_STUDENTS: Student[] = [
    {
        id: '1',
        name: 'Abasiama Essien',
        matricNo: '180404001',
        email: 'abasiama.essien@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        attendanceRate: 95,
    },
    {
        id: '2',
        name: 'Chioma Okonkwo',
        matricNo: '180404002',
        email: 'chioma.okonkwo@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        attendanceRate: 88,
    },
    {
        id: '3',
        name: 'Emeka Nwosu',
        matricNo: '180404003',
        email: 'emeka.nwosu@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
        attendanceRate: 92,
    },
    {
        id: '4',
        name: 'Fatima Ibrahim',
        matricNo: '180404004',
        email: 'fatima.ibrahim@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
        attendanceRate: 78,
    },
    {
        id: '5',
        name: 'Oluwaseun Adeyemi',
        matricNo: '180404005',
        email: 'oluwaseun.adeyemi@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
        attendanceRate: 100,
    },
    {
        id: '6',
        name: 'Ngozi Eze',
        matricNo: '180404006',
        email: 'ngozi.eze@student.edu.ng',
        avatar: 'https://randomuser.me/api/portraits/women/52.jpg',
        attendanceRate: 85,
    },
];

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
                <Image
                    source={{ uri: item.avatar }}
                    className="h-12 w-12 rounded-full"
                    resizeMode="cover"
                />
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
    const { classId, classCode, className, venue, day, startTime, endTime } = route.params;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const fabBounce = useRef(new Animated.Value(1)).current;
    const locationFabBounce = useRef(new Animated.Value(1)).current;
    const addStudentRef = useRef<AddStudentBottomSheetRef>(null);
    const setLocationRef = useRef<SetLocationBottomSheetRef>(null);
    const locationCheckRef = useRef<LocationCheckBottomSheetRef>(null);
    const searchInputRef = useRef<TextInput>(null);

    const [students, setStudents] = useState(MOCK_STUDENTS);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const searchAnim = useRef(new Animated.Value(0)).current;
    const checkInPulse = useRef(new Animated.Value(1)).current;
    const fabRotate = useRef(new Animated.Value(0)).current;

    // Mock class location (in production, this would come from the backend)
    const [classLocation, setClassLocation] = useState<{
        latitude: number;
        longitude: number;
        radius: number;
        name: string;
    } | null>({
        // Default mock location - FUNAAB (Federal University of Agriculture, Abeokuta)
        latitude: 7.2266,
        longitude: 3.4400,
        radius: 50,
        name: venue,
    });

    // Determine if class is currently active based on schedule
    const isClassActive = useMemo(() => {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

        // Check if it's the right day
        if (currentDay !== day) return false;

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
        const startMinutes = parseTime(startTime);
        const endMinutes = parseTime(endTime);

        // Add 15 minutes grace period before class starts
        return currentMinutes >= (startMinutes - 15) && currentMinutes <= endMinutes;
    }, [day, startTime, endTime]);

    // Check-in pulse animation for active class
    useEffect(() => {
        if (isStudent && isClassActive && classLocation && !hasCheckedIn) {
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
    }, [isStudent, isClassActive, classLocation, hasCheckedIn]);

    const handleCheckInSuccess = useCallback(() => {
        setHasCheckedIn(true);

        // Celebration haptic feedback
        celebrationPattern();

        // Send notification
        notifyCheckInSuccess(classCode, className);

        Alert.alert(
            '🎉 Check-In Successful!',
            'Your attendance has been recorded for this class session.',
            [{ text: 'OK' }]
        );
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

    const handleAddStudent = (student: { id: string; name: string; matricNo: string; email: string }) => {
        // Check if student already exists
        if (students.some((s) => s.id === student.id)) {
            return;
        }
        // Add student to the list
        const newStudent: Student = {
            ...student,
            avatar: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 70)}.jpg`,
            attendanceRate: 0,
        };
        setStudents((prev) => [...prev, newStudent]);
    };

    const handleSaveLocation = (location: { latitude: number; longitude: number; radius: number; name: string }) => {
        setClassLocation(location);
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
                            <Text className="font-heading text-[22px] text-[#181A20]">{classCode}</Text>
                            <Text className="text-[13px] text-[#8F94A4]">{className}</Text>
                        </View>
                        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5">
                            <Feather name="more-vertical" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>
                </View>

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
                                    <Text className="font-medium text-[14px] text-[#181A20]">{venue}</Text>
                                </View>
                            </View>
                            {/* Day */}
                            <View className="w-1/2 flex-row items-center mb-3 pl-2">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#FFF3E0]">
                                    <Ionicons name="calendar" size={18} color="#FF9800" />
                                </View>
                                <View className="ml-3">
                                    <Text className="text-[10px] text-[#B8BBC6]">Day</Text>
                                    <Text className="font-medium text-[14px] text-[#181A20]">{day}</Text>
                                </View>
                            </View>
                            {/* Time */}
                            <View className="w-full flex-row items-center">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD]">
                                    <Ionicons name="time" size={18} color="#2196F3" />
                                </View>
                                <View className="ml-3">
                                    <Text className="text-[10px] text-[#B8BBC6]">Time</Text>
                                    <Text className="font-medium text-[14px] text-[#181A20]">{startTime} - {endTime}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Assigned Lecturer */}
                <View className="px-5 mb-4">
                    <View className="rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                        <Text className="text-[12px] text-[#8F94A4] mb-3">Assigned Lecturer</Text>
                        <View className="flex-row items-center">
                            <Image
                                source={{ uri: MOCK_LECTURER.avatar }}
                                className="h-12 w-12 rounded-full"
                                resizeMode="cover"
                            />
                            <View className="ml-3 flex-1">
                                <Text className="font-heading text-[16px] text-[#181A20]">{MOCK_LECTURER.name}</Text>
                                <Text className="text-[12px] text-[#8F94A4] mt-0.5">{MOCK_LECTURER.department}</Text>
                            </View>
                            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F0EDFC]">
                                <Ionicons name="mail" size={16} color={PRIMARY_COLOR} />
                            </View>
                        </View>
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
                                {Math.round(students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length)}%
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
                                    avatar: item.avatar,
                                    classCode,
                                    className,
                                });
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View className="items-center py-8">
                            <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF3E0] mb-3">
                                <Ionicons name="search" size={28} color="#FF9800" />
                            </View>
                            <Text className="font-medium text-[15px] text-[#181A20]">No students found</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">Try a different search term</Text>
                        </View>
                    }
                />
            </Animated.View>

            {/* Floating Action Buttons */}
            {/* Smart Check-In/Directions Button for Students */}
            {isStudent && classLocation && (
                <Pressable
                    onPress={() => {
                        if (isClassActive && !hasCheckedIn) {
                            // Class is active - open location check for check-in flow
                            locationCheckRef.current?.open();
                        } else {
                            // Class not active or already checked in - open directions
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
                            backgroundColor: isClassActive && !hasCheckedIn ? '#4CAF50' : PRIMARY_COLOR,
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: isClassActive && !hasCheckedIn ? '#4CAF50' : PRIMARY_COLOR,
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 8 },
                            elevation: 10,
                            transform: [{ scale: isClassActive && !hasCheckedIn ? checkInPulse : 1 }],
                        }}
                    >
                        {hasCheckedIn ? (
                            <Ionicons name="checkmark-circle" size={30} color="#fff" />
                        ) : isClassActive ? (
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
                            color: isClassActive && !hasCheckedIn ? '#4CAF50' : PRIMARY_COLOR,
                        }}>
                            {hasCheckedIn ? 'Checked In' : isClassActive ? 'Clock In' : 'Directions'}
                        </Text>
                    </View>
                </Pressable>
            )}

            {/* Location Direction Button for Lecturers - Lighter Shade */}
            {isLecturer && classLocation && (
                <Pressable
                    onPress={() => locationCheckRef.current?.open()}
                    style={{ position: 'absolute', bottom: 100, right: 20 }}
                >
                    <View
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
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
                        <MaterialIcons name="directions" size={28} color="#fff" />
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
                        onPress={() => setLocationRef.current?.open()}
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

            {isHOC && (
                <SetLocationBottomSheet
                    ref={setLocationRef}
                    classCode={classCode}
                    onSaveLocation={handleSaveLocation}
                    existingLocation={classLocation}
                />
            )}

            {classLocation && (
                <LocationCheckBottomSheet
                    ref={locationCheckRef}
                    classLocation={classLocation}
                    classCode={classCode}
                    className={className}
                    isClassActive={isClassActive}
                    studentName="Student" // TODO: Replace with actual student name from auth
                    onCheckInSuccess={handleCheckInSuccess}
                />
            )}
        </SafeAreaView>
    );
}
