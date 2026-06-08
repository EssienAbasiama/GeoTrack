import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CLASS_ATTENDANCE_DATA } from '../constants/calendarData';
import type { CalendarStackParamList } from '../types/navigation';
import { attendanceApi } from '../services/apiClient';
import type { ApiAttendanceRecord } from '../types/api';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarAttendance'>;

export function CalendarAttendanceScreen({ route, navigation }: Props) {
    const fallback = CLASS_ATTENDANCE_DATA.find((item) => item.id === route.params.classId);
    const [history, setHistory] = useState<ApiAttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await attendanceApi.myHistory();
                const records = Array.isArray(data?.records)
                    ? data.records
                    : Array.isArray((data?.records as any)?.data)
                        ? (data.records as any).data
                        : [];
                if (mounted) setHistory(records);
            } catch {
                // fall back to mock
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const classItem = useMemo(() => {
        const safeHistory = Array.isArray(history) ? history : [];
        if (safeHistory.length === 0) return fallback;
        // We don't have full course metadata in attendance/history; reuse mock
        // shell with real check-in/out timestamps for the matching classId.
        if (!fallback) return undefined;
        const matchingRecords = safeHistory.filter((r) => String(r.session_id) === route.params.classId);
        if (matchingRecords.length === 0) return fallback;
        return {
            ...fallback,
            attendanceCount: matchingRecords.length,
            records: matchingRecords.map((r, i) => ({
                day: new Date(r.checked_in_at).getDate(),
                checkIn: new Date(r.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                checkOut: '--',
                total: '--',
                active: i === 0,
            })),
        };
    }, [history, fallback, route.params.classId]);

    if (loading && !classItem) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] items-center justify-center">
                <ActivityIndicator color="#6343cc" />
            </SafeAreaView>
        );
    }

    if (!classItem) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-5 pt-3">
                <View className="flex-1 items-center justify-center">
                    <Text className="font-heading text-[18px] text-[#181A20]">Class not found</Text>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="mt-4 rounded-full bg-white px-4 py-2"
                    >
                        <Text className="text-[13px] font-medium text-[#6343cc]">Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <View className="flex-1 pb-[110px]">
                <View className="mb-4 flex-row items-center justify-between">
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="h-10 w-10 items-center justify-center rounded-full bg-white"
                    >
                        <Ionicons name="chevron-back" size={20} color="#6343cc" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Attendance Calendar</Text>
                    <View className="h-10 w-10" />
                </View>

                <View className="mb-2 flex-row items-center justify-between">
                    <View>
                        <Text className="font-heading text-[15px] text-[#181A20]">{classItem.code} Attendance</Text>
                        <Text className="mt-1 text-[12px] text-[#8F93A3]">{classItem.title}</Text>
                    </View>
                    <View className="rounded-full bg-white px-3 py-2">
                        <Text className="text-[12px] font-medium text-[#6343cc]">Class Detail</Text>
                    </View>
                </View>

                <View className="flex-row justify-between mb-4">
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 mr-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="close-circle" size={18} color="#F75555" />
                            <Text className="ml-2 text-[#F75555] font-bold text-[13px]">Absence</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">
                            {String(classItem.absenceCount).padStart(2, '0')}
                        </Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 ml-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="checkmark-circle" size={18} color="#6343cc" />
                            <Text className="ml-2 text-[#6343cc] font-bold text-[13px]">Attendance</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">
                            {String(classItem.attendanceCount).padStart(2, '0')}
                        </Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {classItem.records.map((item) => (
                        <View
                            key={`${classItem.id}-${item.day}`}
                            className={`flex-row items-center mb-3 rounded-[16px] ${item.active ? 'bg-[#6343cc]' : 'bg-white'} px-4 py-5`}
                        >
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${item.active ? 'bg-white' : 'bg-[#ECE9FA]'}`}>
                                <Text
                                    className={`font-heading text-[16px] ${item.active ? 'text-[#6343cc]' : 'text-[#181A20]'}`}
                                    style={{ lineHeight: 32, textAlign: 'center' }}
                                >
                                    {item.day}
                                </Text>
                            </View>
                            <View className="flex-1 flex-row justify-between ml-4">
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? 'text-white' : 'text-[#B7BAC5]'}`}>Check In</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? 'text-white' : 'text-[#181A20]'}`}>{item.checkIn}</Text>
                                </View>
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? 'text-white' : 'text-[#B7BAC5]'}`}>Check Out</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? 'text-white' : 'text-[#181A20]'}`}>{item.checkOut}</Text>
                                </View>
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? 'text-white' : 'text-[#B7BAC5]'}`}>Total Hour</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? 'text-white' : 'text-[#181A20]'}`}>{item.total}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
