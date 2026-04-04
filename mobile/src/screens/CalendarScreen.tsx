import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CLASS_ATTENDANCE_DATA } from '../constants/calendarData';
import type { CalendarStackParamList } from '../types/navigation';

export function CalendarScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<CalendarStackParamList>>();
    const [visibleMonthDate, setVisibleMonthDate] = useState(new Date());

    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    const monthYearLabel = useMemo(
        () =>
            visibleMonthDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            }),
        [visibleMonthDate]
    );

    const hasClassDaySet = useMemo(() => {
        const days = new Set<number>();
        CLASS_ATTENDANCE_DATA.forEach((classItem) => {
            classItem.records.forEach((record) => days.add(record.day));
        });
        return days;
    }, []);

    const monthMeta = useMemo(() => {
        const year = visibleMonthDate.getFullYear();
        const month = visibleMonthDate.getMonth();
        const firstDayWeekIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        return { firstDayWeekIndex, totalDaysInMonth, year, month };
    }, [visibleMonthDate]);

    const calendarCells = useMemo(() => {
        const cells: Array<number | null> = [];
        for (let i = 0; i < monthMeta.firstDayWeekIndex; i += 1) {
            cells.push(null);
        }
        for (let d = 1; d <= monthMeta.totalDaysInMonth; d += 1) {
            cells.push(d);
        }
        while (cells.length % 7 !== 0) {
            cells.push(null);
        }
        return cells;
    }, [monthMeta]);

    const isVisibleCurrentMonth =
        monthMeta.month === todayMonth && monthMeta.year === todayYear;

    const goToPreviousMonth = () => {
        setVisibleMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setVisibleMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    return (
        <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <View className="flex-1 pb-[110px]">
                <Text className="font-heading text-[22px] text-[#181A20] text-center mt-2 mb-4">Attendance Calendar</Text>
                {/* Calendar Month Selector */}
                <View className="flex-row items-center justify-between bg-white rounded-[16px] px-4 py-3 mb-4">
                    <Pressable onPress={goToPreviousMonth} className="h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F8]">
                        <Ionicons name="chevron-back" size={18} color="#8F93A3" />
                    </Pressable>
                    <Text className="font-medium text-[16px] text-[#181A20]">{monthYearLabel}</Text>
                    <Pressable onPress={goToNextMonth} className="h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F8]">
                        <Ionicons name="chevron-forward" size={18} color="#8F93A3" />
                    </Pressable>
                </View>
                {/* Calendar Days Row */}
                <View className="mb-2 flex-row px-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <View key={i} className="h-8 w-[14.28%] items-center justify-center">
                            <Text className={`text-center text-[13px] font-medium ${i === 0 || i === 6 ? "text-[#F75555]" : "text-[#181A20]"}`}>{d}</Text>
                        </View>
                    ))}
                </View>
                <View className="mb-4 flex-row flex-wrap px-2">
                    {calendarCells.map((day, idx) => {
                        if (!day) {
                            return <View key={`empty-${idx}`} className="mb-2 w-[14.28%] h-10" />;
                        }

                        const weekDayIndex = idx % 7;
                        const isWeekend = weekDayIndex === 0 || weekDayIndex === 6;
                        const isToday = isVisibleCurrentMonth && day === todayDay;
                        const hasClassOnDay = hasClassDaySet.has(day);

                        return (
                            <View key={`day-${day}`} className="mb-2 h-10 w-[14.28%] items-center justify-center">
                                <View
                                    className={`relative h-9 w-9 items-center justify-center rounded-full ${isToday ? 'bg-[#6343cc]' : ''}`}
                                >
                                    <Text className={`text-[14px] font-medium ${isToday ? 'text-white' : isWeekend ? 'text-[#F75555]' : 'text-[#181A20]'}`}>
                                        {day}
                                    </Text>
                                    {hasClassOnDay ? (
                                        <View className={`absolute bottom-[4px] h-[4px] w-[4px] rounded-full ${isToday ? 'bg-white' : 'bg-[#6343cc]'}`} />
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                </View>
                <Text className="font-heading text-[15px] text-[#181A20] mb-2">Assigned Classes</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {CLASS_ATTENDANCE_DATA.map((classItem) => (
                        <Pressable
                            key={classItem.id}
                            onPress={() => navigation.navigate('CalendarAttendance', { classId: classItem.id })}
                            className="mb-3 flex-row items-center rounded-[16px] bg-white px-4 py-4"
                        >
                            <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-[#ECE9FA]">
                                <Ionicons name="school-outline" size={18} color="#6343cc" />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text className="font-heading text-[15px] text-[#181A20]">{classItem.code}</Text>
                                <Text className="mt-1 text-[12px] text-[#8F93A3]">{classItem.title}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[12px] text-[#B7BAC5]">Attendance</Text>
                                <Text className="font-bold text-[14px] text-[#6343cc]">{classItem.attendanceCount} days</Text>
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
