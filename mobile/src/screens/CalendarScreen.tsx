import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { courseApi } from '../services/apiClient';
import type { ApiCourse } from '../types/api';
import { formatTimeRange } from '../utils/time';

const PRIMARY = '#6343cc';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduledClass {
    id: string;
    code: string;
    title: string;
    venue: string;
    day: string;
    startTime: string;
    endTime: string;
}

export function CalendarScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const today = useMemo(() => new Date(), []);
    const [visibleMonthDate, setVisibleMonthDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [classes, setClasses] = useState<ScheduledClass[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const { data } = await courseApi.list();
                if (!mounted) return;
                setClasses(
                    (data.courses ?? []).map((c: ApiCourse) => ({
                        id: String(c.id),
                        code: c.code,
                        title: c.title ?? c.name ?? '',
                        venue: c.venue?.trim() || c.geofence?.name?.trim() || '',
                        day: (c.day ?? '').trim(),
                        startTime: c.start_time ?? '',
                        endTime: c.end_time ?? '',
                    })),
                );
            } catch {
                /* leave empty */
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        const unsubscribe = navigation.addListener('focus', load);
        return () => { mounted = false; unsubscribe(); };
    }, [navigation]);

    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    const monthYearLabel = useMemo(
        () => visibleMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        [visibleMonthDate],
    );

    // Weekday names that have at least one class scheduled (for the calendar dots).
    const scheduledWeekdays = useMemo(() => {
        const set = new Set<string>();
        classes.forEach((c) => { if (c.day) set.add(c.day.toLowerCase()); });
        return set;
    }, [classes]);

    const monthMeta = useMemo(() => {
        const year = visibleMonthDate.getFullYear();
        const month = visibleMonthDate.getMonth();
        const firstDayWeekIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        return { firstDayWeekIndex, totalDaysInMonth, year, month };
    }, [visibleMonthDate]);

    const calendarCells = useMemo(() => {
        const cells: Array<number | null> = [];
        for (let i = 0; i < monthMeta.firstDayWeekIndex; i += 1) cells.push(null);
        for (let d = 1; d <= monthMeta.totalDaysInMonth; d += 1) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [monthMeta]);

    const isVisibleCurrentMonth = monthMeta.month === todayMonth && monthMeta.year === todayYear;

    const goToPreviousMonth = () =>
        setVisibleMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const goToNextMonth = () =>
        setVisibleMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    const selectedWeekday = WEEKDAYS[selectedDate.getDay()];
    const isSelectedToday =
        selectedDate.getDate() === todayDay &&
        selectedDate.getMonth() === todayMonth &&
        selectedDate.getFullYear() === todayYear;

    const classesForSelectedDay = useMemo(
        () =>
            classes
                .filter((c) => c.day.toLowerCase() === selectedWeekday.toLowerCase())
                .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        [classes, selectedWeekday],
    );

    const heading = isSelectedToday ? "Today's Classes" : `${selectedWeekday} Classes`;
    const selectedDateLabel = selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <View className="flex-1 pb-[110px]">
                <Text className="font-heading text-[22px] text-[#181A20] text-center mt-2 mb-4">Class Calendar</Text>

                {/* Month selector */}
                <View className="flex-row items-center justify-between bg-white rounded-[16px] px-4 py-3 mb-4">
                    <Pressable onPress={goToPreviousMonth} className="h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F8]">
                        <Ionicons name="chevron-back" size={18} color="#8F93A3" />
                    </Pressable>
                    <Text className="font-medium text-[16px] text-[#181A20]">{monthYearLabel}</Text>
                    <Pressable onPress={goToNextMonth} className="h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F8]">
                        <Ionicons name="chevron-forward" size={18} color="#8F93A3" />
                    </Pressable>
                </View>

                {/* Weekday header */}
                <View className="mb-2 flex-row px-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <View key={i} className="h-8 w-[14.28%] items-center justify-center">
                            <Text className={`text-center text-[13px] font-medium ${i === 0 || i === 6 ? 'text-[#F75555]' : 'text-[#181A20]'}`}>{d}</Text>
                        </View>
                    ))}
                </View>

                {/* Day grid */}
                <View className="mb-4 flex-row flex-wrap px-2">
                    {calendarCells.map((day, idx) => {
                        if (!day) return <View key={`empty-${idx}`} className="mb-2 w-[14.28%] h-10" />;

                        const weekDayIndex = idx % 7;
                        const isWeekend = weekDayIndex === 0 || weekDayIndex === 6;
                        const isToday = isVisibleCurrentMonth && day === todayDay;
                        const isSelected =
                            selectedDate.getDate() === day &&
                            selectedDate.getMonth() === monthMeta.month &&
                            selectedDate.getFullYear() === monthMeta.year;
                        const hasClassOnDay = scheduledWeekdays.has(WEEKDAYS[weekDayIndex].toLowerCase());

                        return (
                            <Pressable
                                key={`day-${day}`}
                                onPress={() => setSelectedDate(new Date(monthMeta.year, monthMeta.month, day))}
                                className="mb-2 h-10 w-[14.28%] items-center justify-center"
                            >
                                <View
                                    className="relative h-9 w-9 items-center justify-center rounded-full"
                                    style={{
                                        backgroundColor: isSelected ? PRIMARY : isToday ? '#EEEAFD' : 'transparent',
                                    }}
                                >
                                    <Text
                                        className="text-[14px] font-medium"
                                        style={{
                                            color: isSelected ? '#fff' : isToday ? PRIMARY : isWeekend ? '#F75555' : '#181A20',
                                        }}
                                    >
                                        {day}
                                    </Text>
                                    {hasClassOnDay ? (
                                        <View
                                            className="absolute bottom-[4px] h-[4px] w-[4px] rounded-full"
                                            style={{ backgroundColor: isSelected ? '#fff' : PRIMARY }}
                                        />
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Selected-day header */}
                <View className="flex-row items-center justify-between mb-2">
                    <View>
                        <Text className="font-heading text-[16px] text-[#181A20]">{heading}</Text>
                        <Text className="text-[12px] text-[#8F93A3] mt-0.5">{selectedDateLabel}</Text>
                    </View>
                    <View className="px-2.5 py-1 rounded-full bg-[#F0EDFC]">
                        <Text className="text-[12px] font-medium text-[#6343cc]">
                            {classesForSelectedDay.length} {classesForSelectedDay.length === 1 ? 'class' : 'classes'}
                        </Text>
                    </View>
                </View>

                {/* Classes for the selected day */}
                {loading ? (
                    <View className="items-center py-10">
                        <ActivityIndicator color={PRIMARY} />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {classesForSelectedDay.length === 0 ? (
                            <View className="items-center py-10">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                    <Ionicons name="calendar-clear-outline" size={26} color={PRIMARY} />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No classes on {selectedWeekday}</Text>
                                <Text className="text-[13px] text-[#8F93A3] mt-1 text-center">
                                    Pick another day to see its schedule.
                                </Text>
                            </View>
                        ) : (
                            classesForSelectedDay.map((c) => (
                                <Pressable
                                    key={c.id}
                                    onPress={() =>
                                        navigation.navigate('ClassDetail', {
                                            classId: c.id,
                                            classCode: c.code,
                                            className: c.title,
                                            venue: c.venue,
                                            day: c.day,
                                            startTime: c.startTime,
                                            endTime: c.endTime,
                                        })
                                    }
                                    className="mb-3 flex-row items-center rounded-[16px] bg-white px-4 py-4 active:opacity-90"
                                >
                                    <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-[#ECE9FA]">
                                        <Ionicons name="school-outline" size={18} color="#6343cc" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-heading text-[15px] text-[#181A20]">{c.code}</Text>
                                        <Text className="mt-0.5 text-[12px] text-[#8F93A3]" numberOfLines={1}>{c.title}</Text>
                                        <View className="flex-row items-center mt-1.5">
                                            <Ionicons name="location-outline" size={12} color="#B7BAC5" />
                                            <Text className="ml-1 text-[11px] text-[#B7BAC5]" numberOfLines={1}>
                                                {c.venue || 'No location'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <View className="flex-row items-center">
                                            <Ionicons name="time-outline" size={12} color="#6343cc" />
                                            <Text className="ml-1 font-medium text-[12px] text-[#6343cc]">
                                                {formatTimeRange(c.startTime, c.endTime) || '—'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginTop: 6 }} />
                                    </View>
                                </Pressable>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
