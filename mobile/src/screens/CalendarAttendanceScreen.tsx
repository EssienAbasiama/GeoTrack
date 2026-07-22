import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CalendarStackParamList } from '../types/navigation';
import { attendanceApi } from '../services/apiClient';
import type { ApiAttendanceRecord } from '../types/api';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarAttendance'>;

interface DayRow {
    key: string;
    day: number;
    checkIn: string;
    checkOut: string;
    total: string;
    stillIn: boolean;
    reEntries: number;
    active: boolean;
}

const fmtTime = (iso?: string | null) =>
    iso
        ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--';

const fmtDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}h` : `${m}m`;
};

export function CalendarAttendanceScreen({ route, navigation }: Props) {
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
                if (mounted) setHistory([]);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const view = useMemo(() => {
        const safe = Array.isArray(history) ? history : [];
        // classId is a course id — match on the session's course, not the session.
        const mine = safe.filter(
            (r) => String((r as any).session?.course_id ?? '') === String(route.params.classId),
        );
        const course = (mine[0] as any)?.session?.course;

        const rows: DayRow[] = mine
            .filter((r) => r.checked_in_at)
            .sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())
            .map((r, i) => ({
                key: String(r.id ?? i),
                day: new Date(r.checked_in_at).getDate(),
                checkIn: fmtTime(r.checked_in_at),
                checkOut: r.checked_out_at
                    ? fmtTime(r.checked_out_at)
                    : r.still_in_class
                        ? 'In class'
                        : '--:--',
                total: fmtDuration(r.minutes_present ?? 0),
                stillIn: Boolean(r.still_in_class),
                reEntries: r.re_entry_count ?? 0,
                active: i === 0,
            }));

        return {
            code: course?.code ?? 'Attendance',
            title: course?.title ?? '',
            attended: rows.length,
            absences: mine.filter((r) => r.status === 'absent').length,
            rows,
        };
    }, [history, route.params.classId]);

    if (loading) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] items-center justify-center">
                <ActivityIndicator color="#6343cc" />
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

                <View className="mb-2">
                    <Text className="font-heading text-[15px] text-[#181A20]">{view.code} Attendance</Text>
                    {view.title ? (
                        <Text className="mt-1 text-[12px] text-[#8F93A3]">{view.title}</Text>
                    ) : null}
                </View>

                <View className="flex-row justify-between mb-4">
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 mr-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="close-circle" size={18} color="#F75555" />
                            <Text className="ml-2 text-[#F75555] font-bold text-[13px]">Absence</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">
                            {String(view.absences).padStart(2, '0')}
                        </Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 ml-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="checkmark-circle" size={18} color="#6343cc" />
                            <Text className="ml-2 text-[#6343cc] font-bold text-[13px]">Attendance</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">
                            {String(view.attended).padStart(2, '0')}
                        </Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                </View>

                {view.rows.length === 0 ? (
                    <View className="items-center py-10">
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                            <Ionicons name="calendar-clear-outline" size={26} color="#6343cc" />
                        </View>
                        <Text className="font-medium text-[15px] text-[#181A20]">No attendance yet</Text>
                        <Text className="text-[13px] text-[#8F93A3] mt-1 text-center">
                            Records appear here once you clock in to this class.
                        </Text>
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {view.rows.map((item) => (
                            <View
                                key={item.key}
                                className={`mb-3 rounded-[16px] ${item.active ? 'bg-[#6343cc]' : 'bg-white'} px-4 py-5`}
                            >
                                <View className="flex-row items-center">
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

                                {item.reEntries > 0 && (
                                    <View className="flex-row items-center mt-3">
                                        <Ionicons
                                            name="swap-horizontal"
                                            size={13}
                                            color={item.active ? '#E5DEFF' : '#F59E0B'}
                                        />
                                        <Text className={`ml-1.5 text-[11px] ${item.active ? 'text-[#E5DEFF]' : 'text-[#B45309]'}`}>
                                            Left and returned {item.reEntries}{' '}
                                            {item.reEntries === 1 ? 'time' : 'times'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
