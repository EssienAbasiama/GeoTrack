import { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { PieChart, LineChart, BarChart } from 'react-native-gifted-charts';

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock session data - in production this would come from backend
interface SessionRecord {
    id: string;
    date: string;
    day: string;
    checkInTime: string;
    checkOutTime: string | null;
    durationMinutes: number;
    expectedDurationMinutes: number;
    status: 'present' | 'late' | 'absent' | 'excused';
    wasOnTime: boolean;
    locationVerified: boolean;
}

const MOCK_SESSIONS: SessionRecord[] = [
    {
        id: '1',
        date: '2026-04-15',
        day: 'Wednesday',
        checkInTime: '09:02',
        checkOutTime: '10:55',
        durationMinutes: 113,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
    {
        id: '2',
        date: '2026-04-08',
        day: 'Wednesday',
        checkInTime: '09:12',
        checkOutTime: '10:58',
        durationMinutes: 106,
        expectedDurationMinutes: 120,
        status: 'late',
        wasOnTime: false,
        locationVerified: true,
    },
    {
        id: '3',
        date: '2026-04-01',
        day: 'Wednesday',
        checkInTime: '09:00',
        checkOutTime: '11:00',
        durationMinutes: 120,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
    {
        id: '4',
        date: '2026-03-25',
        day: 'Wednesday',
        checkInTime: null as any,
        checkOutTime: null,
        durationMinutes: 0,
        expectedDurationMinutes: 120,
        status: 'absent',
        wasOnTime: false,
        locationVerified: false,
    },
    {
        id: '5',
        date: '2026-03-18',
        day: 'Wednesday',
        checkInTime: '09:05',
        checkOutTime: '10:45',
        durationMinutes: 100,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
    {
        id: '6',
        date: '2026-03-11',
        day: 'Wednesday',
        checkInTime: '09:00',
        checkOutTime: '11:02',
        durationMinutes: 122,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
    {
        id: '7',
        date: '2026-03-04',
        day: 'Wednesday',
        checkInTime: null as any,
        checkOutTime: null,
        durationMinutes: 0,
        expectedDurationMinutes: 120,
        status: 'excused',
        wasOnTime: false,
        locationVerified: false,
    },
    {
        id: '8',
        date: '2026-02-25',
        day: 'Wednesday',
        checkInTime: '09:20',
        checkOutTime: '10:50',
        durationMinutes: 90,
        expectedDurationMinutes: 120,
        status: 'late',
        wasOnTime: false,
        locationVerified: true,
    },
    {
        id: '9',
        date: '2026-02-18',
        day: 'Wednesday',
        checkInTime: '09:01',
        checkOutTime: '10:59',
        durationMinutes: 118,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
    {
        id: '10',
        date: '2026-02-11',
        day: 'Wednesday',
        checkInTime: '09:00',
        checkOutTime: '11:00',
        durationMinutes: 120,
        expectedDurationMinutes: 120,
        status: 'present',
        wasOnTime: true,
        locationVerified: true,
    },
];

// Analytics calculations
function calculateAnalytics(sessions: SessionRecord[]) {
    const totalSessions = sessions.length;
    const presentSessions = sessions.filter(s => s.status === 'present').length;
    const lateSessions = sessions.filter(s => s.status === 'late').length;
    const absentSessions = sessions.filter(s => s.status === 'absent').length;
    const excusedSessions = sessions.filter(s => s.status === 'excused').length;

    const attendedSessions = sessions.filter(s => s.status === 'present' || s.status === 'late');
    const onTimeSessions = sessions.filter(s => s.wasOnTime).length;

    const totalDuration = attendedSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalExpectedDuration = attendedSessions.reduce((sum, s) => sum + s.expectedDurationMinutes, 0);
    const avgDuration = attendedSessions.length > 0 ? totalDuration / attendedSessions.length : 0;

    const attendanceRate = totalSessions > 0 ? ((presentSessions + lateSessions) / totalSessions) * 100 : 0;
    const punctualityRate = (presentSessions + lateSessions) > 0
        ? (onTimeSessions / (presentSessions + lateSessions)) * 100
        : 0;
    const durationRate = totalExpectedDuration > 0 ? (totalDuration / totalExpectedDuration) * 100 : 0;

    // Calculate suggested grade based on metrics
    const overallScore = (attendanceRate * 0.4) + (punctualityRate * 0.3) + (durationRate * 0.3);
    let suggestedGrade = 'F';
    if (overallScore >= 90) suggestedGrade = 'A';
    else if (overallScore >= 80) suggestedGrade = 'B';
    else if (overallScore >= 70) suggestedGrade = 'C';
    else if (overallScore >= 60) suggestedGrade = 'D';
    else if (overallScore >= 50) suggestedGrade = 'E';

    return {
        totalSessions,
        presentSessions,
        lateSessions,
        absentSessions,
        excusedSessions,
        attendanceRate: Math.round(attendanceRate),
        punctualityRate: Math.round(punctualityRate),
        durationRate: Math.round(durationRate),
        avgDuration: Math.round(avgDuration),
        totalDuration,
        overallScore: Math.round(overallScore),
        suggestedGrade,
    };
}

// Get weekly attendance data for line chart
function getWeeklyData(sessions: SessionRecord[]) {
    // Group by week and calculate attendance
    const sortedSessions = [...sessions].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sortedSessions.slice(-6).map(s => ({
        label: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: s.status === 'present' ? 100 : s.status === 'late' ? 70 : 0,
        duration: s.durationMinutes,
    }));
}

function SessionCard({ session, index }: { session: SessionRecord; index: number }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            delay: index * 50,
            useNativeDriver: true,
            speed: 14,
            bounciness: 4,
        }).start();
    }, [index]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return '#22C55E';
            case 'late': return '#F59E0B';
            case 'absent': return '#EF4444';
            case 'excused': return '#8B5CF6';
            default: return '#8F94A4';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'present': return 'checkmark-circle';
            case 'late': return 'time';
            case 'absent': return 'close-circle';
            case 'excused': return 'information-circle';
            default: return 'help-circle';
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    return (
        <Animated.View style={{ opacity: scaleAnim, transform: [{ scale: scaleAnim }] }}>
            <View className="bg-white rounded-[16px] p-4 mb-3 shadow-sm shadow-black/5">
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                        <View
                            className="h-10 w-10 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${getStatusColor(session.status)}15` }}
                        >
                            <Ionicons
                                name={getStatusIcon(session.status) as any}
                                size={22}
                                color={getStatusColor(session.status)}
                            />
                        </View>
                        <View className="ml-3">
                            <Text className="font-medium text-[14px] text-[#181A20]">
                                {new Date(session.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Text>
                            <Text
                                className="text-[12px] capitalize"
                                style={{ color: getStatusColor(session.status) }}
                            >
                                {session.status}
                            </Text>
                        </View>
                    </View>
                    {session.locationVerified && (
                        <View className="flex-row items-center px-2 py-1 rounded-full bg-[#E8F5E9]">
                            <Ionicons name="location" size={12} color="#4CAF50" />
                            <Text className="text-[10px] text-[#4CAF50] ml-1">Verified</Text>
                        </View>
                    )}
                </View>

                {session.status !== 'absent' && session.status !== 'excused' && (
                    <View className="flex-row gap-3">
                        <View className="flex-1 rounded-[12px] bg-[#F6F6F9] p-3">
                            <View className="flex-row items-center">
                                <Ionicons name="log-in" size={16} color="#8F94A4" />
                                <Text className="text-[10px] text-[#8F94A4] ml-1">Check In</Text>
                            </View>
                            <Text className="font-heading text-[16px] text-[#181A20] mt-1">
                                {session.checkInTime || '--:--'}
                            </Text>
                        </View>
                        <View className="flex-1 rounded-[12px] bg-[#F6F6F9] p-3">
                            <View className="flex-row items-center">
                                <Ionicons name="log-out" size={16} color="#8F94A4" />
                                <Text className="text-[10px] text-[#8F94A4] ml-1">Check Out</Text>
                            </View>
                            <Text className="font-heading text-[16px] text-[#181A20] mt-1">
                                {session.checkOutTime || '--:--'}
                            </Text>
                        </View>
                        <View className="flex-1 rounded-[12px] bg-[#F0EDFC] p-3">
                            <View className="flex-row items-center">
                                <Ionicons name="timer" size={16} color={PRIMARY_COLOR} />
                                <Text className="text-[10px] text-[#8F94A4] ml-1">Duration</Text>
                            </View>
                            <Text className="font-heading text-[16px] text-[#6343cc] mt-1">
                                {formatDuration(session.durationMinutes)}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Animated.View>
    );
}

export function StudentDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'StudentDetail'>>();
    const { studentId, studentName, matricNo, email, avatar, classCode, className } = route.params;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions'>('overview');
    const [sessions] = useState(MOCK_SESSIONS);

    const analytics = calculateAnalytics(sessions);
    const weeklyData = getWeeklyData(sessions);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Pie chart data for react-native-gifted-charts
    const pieChartData = [
        { value: analytics.presentSessions, color: '#22C55E', text: `${analytics.presentSessions}` },
        { value: analytics.lateSessions, color: '#F59E0B', text: `${analytics.lateSessions}` },
        { value: analytics.absentSessions, color: '#EF4444', text: `${analytics.absentSessions}` },
        { value: analytics.excusedSessions, color: '#8B5CF6', text: `${analytics.excusedSessions}` },
    ].filter(d => d.value > 0);

    // Line chart data for react-native-gifted-charts
    const lineChartData = weeklyData.map(d => ({
        value: d.value,
        label: d.label.split(' ')[1],
        dataPointText: `${d.value}%`,
    }));

    // Bar chart data for react-native-gifted-charts
    const barChartDataFormatted = weeklyData.map(d => ({
        value: d.duration,
        label: d.label.split(' ')[1],
        frontColor: PRIMARY_COLOR,
    }));

    const renderGradeCard = () => {
        const getGradeColor = (grade: string) => {
            switch (grade) {
                case 'A': return '#22C55E';
                case 'B': return '#34D399';
                case 'C': return '#F59E0B';
                case 'D': return '#FB923C';
                case 'E': return '#EF4444';
                default: return '#DC2626';
            }
        };

        return (
            <View className="bg-white rounded-[20px] p-5 mb-4 shadow-sm shadow-black/5">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="font-heading text-[18px] text-[#181A20]">Suggested Grade</Text>
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="calculator" size={18} color="#8F94A4" />
                        <Text className="text-[12px] text-[#8F94A4] ml-1">Auto-calculated</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    <View
                        className="h-20 w-20 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${getGradeColor(analytics.suggestedGrade)}15` }}
                    >
                        <Text
                            className="font-heading text-[40px]"
                            style={{ color: getGradeColor(analytics.suggestedGrade) }}
                        >
                            {analytics.suggestedGrade}
                        </Text>
                    </View>
                    <View className="ml-5 flex-1">
                        <View className="flex-row items-center mb-2">
                            <Text className="text-[13px] text-[#8F94A4] w-24">Overall Score</Text>
                            <View className="flex-1 h-2 rounded-full bg-[#F1F2F6] overflow-hidden">
                                <View
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${analytics.overallScore}%`,
                                        backgroundColor: getGradeColor(analytics.suggestedGrade),
                                    }}
                                />
                            </View>
                            <Text className="font-medium text-[13px] text-[#181A20] ml-2 w-10">
                                {analytics.overallScore}%
                            </Text>
                        </View>
                        <Text className="text-[11px] text-[#8F94A4]">
                            Based on attendance ({analytics.attendanceRate}%), punctuality ({analytics.punctualityRate}%),
                            and class duration ({analytics.durationRate}%)
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-[#F6F6F9]">
            <Animated.View
                style={{
                    flex: 1,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                }}
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-3">
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm shadow-black/10"
                    >
                        <Ionicons name="arrow-back" size={22} color="#181A20" />
                    </Pressable>
                    <View className="flex-1 items-center">
                        <Text className="font-heading text-[18px] text-[#181A20]">Student Analytics</Text>
                        <Text className="text-[12px] text-[#8F94A4]">{classCode}</Text>
                    </View>
                    <View className="w-11" />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Student Profile Card */}
                    <View className="px-5 mb-4">
                        <View className="bg-white rounded-[20px] p-5 shadow-sm shadow-black/5">
                            <View className="flex-row items-center">
                                <Image
                                    source={{ uri: avatar }}
                                    className="h-16 w-16 rounded-full"
                                    resizeMode="cover"
                                />
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[18px] text-[#181A20]">{studentName}</Text>
                                    <Text className="text-[13px] text-[#8F94A4] mt-0.5">{matricNo}</Text>
                                    <Text className="text-[12px] text-[#6343cc] mt-1">{email}</Text>
                                </View>
                            </View>

                            {/* Quick Stats */}
                            <View className="flex-row mt-5 gap-3">
                                <View className="flex-1 rounded-[14px] bg-[#F0EDFC] p-3 items-center">
                                    <Text className="font-heading text-[24px] text-[#6343cc]">
                                        {analytics.attendanceRate}%
                                    </Text>
                                    <Text className="text-[11px] text-[#8F94A4] mt-1">Attendance</Text>
                                </View>
                                <View className="flex-1 rounded-[14px] bg-[#E8F5E9] p-3 items-center">
                                    <Text className="font-heading text-[24px] text-[#22C55E]">
                                        {analytics.punctualityRate}%
                                    </Text>
                                    <Text className="text-[11px] text-[#8F94A4] mt-1">Punctuality</Text>
                                </View>
                                <View className="flex-1 rounded-[14px] bg-[#FFF3E0] p-3 items-center">
                                    <Text className="font-heading text-[24px] text-[#F59E0B]">
                                        {analytics.avgDuration}m
                                    </Text>
                                    <Text className="text-[11px] text-[#8F94A4] mt-1">Avg Duration</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Tab Selector */}
                    <View className="flex-row mx-5 mb-4 p-1 rounded-[14px] bg-white">
                        <Pressable
                            onPress={() => setActiveTab('overview')}
                            className={`flex-1 py-3 rounded-[12px] items-center ${activeTab === 'overview' ? 'bg-[#6343cc]' : ''
                                }`}
                        >
                            <Text
                                className={`font-medium text-[14px] ${activeTab === 'overview' ? 'text-white' : 'text-[#8F94A4]'
                                    }`}
                            >
                                Overview
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveTab('sessions')}
                            className={`flex-1 py-3 rounded-[12px] items-center ${activeTab === 'sessions' ? 'bg-[#6343cc]' : ''
                                }`}
                        >
                            <Text
                                className={`font-medium text-[14px] ${activeTab === 'sessions' ? 'text-white' : 'text-[#8F94A4]'
                                    }`}
                            >
                                Sessions ({sessions.length})
                            </Text>
                        </Pressable>
                    </View>

                    {activeTab === 'overview' ? (
                        <View className="px-5">
                            {/* Suggested Grade Card */}
                            {renderGradeCard()}

                            {/* Attendance Pie Chart */}
                            <View className="bg-white rounded-[20px] p-5 mb-4 shadow-sm shadow-black/5">
                                <Text className="font-heading text-[16px] text-[#181A20] mb-4">
                                    Attendance Distribution
                                </Text>
                                <View className="items-center">
                                    <PieChart
                                        data={pieChartData}
                                        donut
                                        radius={70}
                                        innerRadius={45}
                                        centerLabelComponent={() => (
                                            <View className="items-center">
                                                <Text className="font-heading text-[20px] text-[#181A20]">
                                                    {analytics.totalSessions}
                                                </Text>
                                                <Text className="text-[10px] text-[#8F94A4]">Sessions</Text>
                                            </View>
                                        )}
                                    />
                                </View>
                                <View className="flex-row flex-wrap justify-center gap-3 mt-3">
                                    <View className="flex-row items-center">
                                        <View className="h-3 w-3 rounded-full bg-[#22C55E] mr-1.5" />
                                        <Text className="text-[12px] text-[#5A5D6B]">
                                            Present ({analytics.presentSessions})
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <View className="h-3 w-3 rounded-full bg-[#F59E0B] mr-1.5" />
                                        <Text className="text-[12px] text-[#5A5D6B]">
                                            Late ({analytics.lateSessions})
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <View className="h-3 w-3 rounded-full bg-[#EF4444] mr-1.5" />
                                        <Text className="text-[12px] text-[#5A5D6B]">
                                            Absent ({analytics.absentSessions})
                                        </Text>
                                    </View>
                                    {analytics.excusedSessions > 0 && (
                                        <View className="flex-row items-center">
                                            <View className="h-3 w-3 rounded-full bg-[#8B5CF6] mr-1.5" />
                                            <Text className="text-[12px] text-[#5A5D6B]">
                                                Excused ({analytics.excusedSessions})
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Weekly Trend Line Chart */}
                            <View className="bg-white rounded-[20px] p-5 mb-4 shadow-sm shadow-black/5">
                                <Text className="font-heading text-[16px] text-[#181A20] mb-4">
                                    Attendance Trend
                                </Text>
                                <LineChart
                                    data={lineChartData}
                                    width={SCREEN_WIDTH - 100}
                                    height={150}
                                    color={PRIMARY_COLOR}
                                    thickness={3}
                                    dataPointsColor={PRIMARY_COLOR}
                                    xAxisLabelTextStyle={{ color: '#8F94A4', fontSize: 10 }}
                                    yAxisTextStyle={{ color: '#8F94A4', fontSize: 10 }}
                                    hideRules
                                    curved
                                    areaChart
                                    startFillColor="rgba(99, 67, 204, 0.3)"
                                    endFillColor="rgba(99, 67, 204, 0.05)"
                                    startOpacity={0.9}
                                    endOpacity={0.2}
                                    spacing={40}
                                    initialSpacing={20}
                                    maxValue={100}
                                    noOfSections={4}
                                />
                                <Text className="text-[11px] text-[#8F94A4] text-center mt-2">
                                    100% = On-time, 70% = Late, 0% = Absent
                                </Text>
                            </View>

                            {/* Duration Bar Chart */}
                            <View className="bg-white rounded-[20px] p-5 mb-4 shadow-sm shadow-black/5">
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="font-heading text-[16px] text-[#181A20]">
                                        Session Duration
                                    </Text>
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="timer" size={16} color="#8F94A4" />
                                        <Text className="text-[12px] text-[#8F94A4] ml-1">
                                            Total: {Math.round(analytics.totalDuration / 60)}h
                                        </Text>
                                    </View>
                                </View>
                                <BarChart
                                    data={barChartDataFormatted}
                                    width={SCREEN_WIDTH - 100}
                                    height={150}
                                    barWidth={25}
                                    spacing={20}
                                    initialSpacing={15}
                                    roundedTop
                                    roundedBottom
                                    xAxisLabelTextStyle={{ color: '#8F94A4', fontSize: 10 }}
                                    yAxisTextStyle={{ color: '#8F94A4', fontSize: 10 }}
                                    hideRules
                                    noOfSections={4}
                                    maxValue={150}
                                    yAxisSuffix="m"
                                />
                                <Text className="text-[11px] text-[#8F94A4] text-center mt-2">
                                    Minutes spent in class per session
                                </Text>
                            </View>

                            {/* Detailed Analytics */}
                            <View className="bg-white rounded-[20px] p-5 mb-6 shadow-sm shadow-black/5">
                                <Text className="font-heading text-[16px] text-[#181A20] mb-4">
                                    Detailed Metrics
                                </Text>

                                <View className="space-y-3">
                                    {/* Attendance Rate */}
                                    <View className="flex-row items-center justify-between py-2 border-b border-[#F1F2F6]">
                                        <View className="flex-row items-center">
                                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#F0EDFC]">
                                                <Ionicons name="calendar" size={16} color={PRIMARY_COLOR} />
                                            </View>
                                            <Text className="text-[14px] text-[#5A5D6B] ml-3">
                                                Total Sessions Attended
                                            </Text>
                                        </View>
                                        <Text className="font-medium text-[14px] text-[#181A20]">
                                            {analytics.presentSessions + analytics.lateSessions} / {analytics.totalSessions}
                                        </Text>
                                    </View>

                                    {/* On-Time Sessions */}
                                    <View className="flex-row items-center justify-between py-2 border-b border-[#F1F2F6]">
                                        <View className="flex-row items-center">
                                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5E9]">
                                                <Ionicons name="time" size={16} color="#22C55E" />
                                            </View>
                                            <Text className="text-[14px] text-[#5A5D6B] ml-3">
                                                On-Time Arrivals
                                            </Text>
                                        </View>
                                        <Text className="font-medium text-[14px] text-[#181A20]">
                                            {sessions.filter(s => s.wasOnTime).length} sessions
                                        </Text>
                                    </View>

                                    {/* Average Duration */}
                                    <View className="flex-row items-center justify-between py-2 border-b border-[#F1F2F6]">
                                        <View className="flex-row items-center">
                                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#FFF3E0]">
                                                <Ionicons name="timer" size={16} color="#F59E0B" />
                                            </View>
                                            <Text className="text-[14px] text-[#5A5D6B] ml-3">
                                                Average Duration
                                            </Text>
                                        </View>
                                        <Text className="font-medium text-[14px] text-[#181A20]">
                                            {analytics.avgDuration} mins
                                        </Text>
                                    </View>

                                    {/* Duration Compliance */}
                                    <View className="flex-row items-center justify-between py-2 border-b border-[#F1F2F6]">
                                        <View className="flex-row items-center">
                                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#E3F2FD]">
                                                <MaterialIcons name="check-circle" size={16} color="#2196F3" />
                                            </View>
                                            <Text className="text-[14px] text-[#5A5D6B] ml-3">
                                                Duration Compliance
                                            </Text>
                                        </View>
                                        <Text className="font-medium text-[14px] text-[#181A20]">
                                            {analytics.durationRate}%
                                        </Text>
                                    </View>

                                    {/* Location Verified */}
                                    <View className="flex-row items-center justify-between py-2">
                                        <View className="flex-row items-center">
                                            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#F3E5F5]">
                                                <Ionicons name="location" size={16} color="#9C27B0" />
                                            </View>
                                            <Text className="text-[14px] text-[#5A5D6B] ml-3">
                                                Location Verified
                                            </Text>
                                        </View>
                                        <Text className="font-medium text-[14px] text-[#181A20]">
                                            {sessions.filter(s => s.locationVerified).length} sessions
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View className="px-5 pb-6">
                            {/* Session History */}
                            <Text className="font-medium text-[13px] text-[#8F94A4] mb-3">
                                SESSION HISTORY
                            </Text>
                            {sessions.map((session, index) => (
                                <SessionCard key={session.id} session={session} index={index} />
                            ))}
                        </View>
                    )}
                </ScrollView>
            </Animated.View>
        </SafeAreaView>
    );
}
