import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    View,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { sessionApi } from '../services/apiClient';
import type { ApiAttendanceRecord, ApiSession } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'LecturerSession'>;

const PRIMARY = '#6343cc';

export function LecturerSessionScreen({ route, navigation }: Props) {
    const { sessionId, classCode, className } = route.params;
    const [records, setRecords] = useState<ApiAttendanceRecord[]>([]);
    const [session, setSession] = useState<ApiSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [closing, setClosing] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadRecords = useCallback(async () => {
        try {
            const [recs, sess] = await Promise.all([
                sessionApi.records(sessionId),
                sessionApi.get(sessionId),
            ]);
            setRecords(recs.data.records);
            setSession(sess.data.session);
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Failed to load session records.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    }, [sessionId]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            await loadRecords();
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
    }, [loadRecords]);

    // Poll every 8s while session is active
    useEffect(() => {
        if (!session || session.status !== 'active') return;
        pollRef.current = setInterval(() => {
            loadRecords();
        }, 8_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [session, loadRecords]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadRecords();
        setRefreshing(false);
    };

    const handlePresenceCheck = async () => {
        setTriggering(true);
        try {
            await sessionApi.manualPresenceCheck(sessionId);
            Toast.show({
                type: 'success',
                text1: 'Presence check sent to all students.',
                position: 'bottom',
            });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not trigger presence check.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setTriggering(false);
        }
    };

    const handleClose = async () => {
        setClosing(true);
        try {
            await sessionApi.close(sessionId);
            Toast.show({ type: 'success', text1: 'Session closed.', position: 'bottom' });
            navigation.goBack();
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not close session.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setClosing(false);
        }
    };

    const isActive = session?.status === 'active';

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="px-5 pt-3 pb-4 flex-row items-center">
                <Pressable
                    onPress={() => navigation.goBack()}
                    className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5 mr-3"
                >
                    <Ionicons name="chevron-back" size={20} color="#181A20" />
                </Pressable>
                <View className="flex-1">
                    <Text className="font-heading text-[20px] text-[#181A20]">{classCode}</Text>
                    <Text className="text-[12px] text-[#8F94A4]">{className}</Text>
                </View>
                <View
                    className="rounded-full px-3 py-1.5"
                    style={{
                        backgroundColor: isActive ? '#E8F5E9' : '#F1F2F6',
                    }}
                >
                    <Text
                        className="text-[12px] font-medium"
                        style={{ color: isActive ? '#22C55E' : '#5A5D6B' }}
                    >
                        {isActive ? 'LIVE' : 'Closed'}
                    </Text>
                </View>
            </View>

            <View className="px-5 mb-4 flex-row gap-3">
                <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F0EDFC] mb-2">
                        <Ionicons name="people" size={18} color={PRIMARY} />
                    </View>
                    <Text className="font-heading text-[22px] text-[#181A20]">{records.length}</Text>
                    <Text className="text-[12px] text-[#8F94A4]">Checked in</Text>
                </View>
                <View className="flex-1 rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] mb-2">
                        <Ionicons name="time" size={18} color="#2196F3" />
                    </View>
                    <Text className="font-heading text-[14px] text-[#181A20]">
                        {session?.starts_at
                            ? new Date(session.starts_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })
                            : '--'}
                    </Text>
                    <Text className="text-[12px] text-[#8F94A4]">Started</Text>
                </View>
            </View>

            {isActive && (
                <View className="px-5 mb-3 flex-row gap-3">
                    <Pressable
                        onPress={handlePresenceCheck}
                        disabled={triggering}
                        className="flex-1 h-11 items-center justify-center rounded-full bg-[#6343cc] flex-row"
                    >
                        {triggering ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="bell-ring" size={18} color="#fff" />
                                <Text className="ml-2 font-medium text-[14px] text-white">
                                    Presence check
                                </Text>
                            </>
                        )}
                    </Pressable>
                    <Pressable
                        onPress={handleClose}
                        disabled={closing}
                        className="flex-1 h-11 items-center justify-center rounded-full bg-[#cc4361] flex-row"
                    >
                        {closing ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="stop-circle" size={18} color="#fff" />
                                <Text className="ml-2 font-medium text-[14px] text-white">
                                    End session
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            )}

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={PRIMARY} />
                </View>
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                <Ionicons name="person-add" size={28} color={PRIMARY} />
                            </View>
                            <Text className="font-medium text-[15px] text-[#181A20]">
                                Waiting for students
                            </Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">
                                Check-ins will appear here in real-time.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View className="mb-3 rounded-[16px] bg-white p-4 flex-row items-center shadow-sm shadow-black/5">
                            {item.student?.avatar_url ? (
                                <Image
                                    source={{ uri: item.student.avatar_url }}
                                    className="h-11 w-11 rounded-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F0EDFC]">
                                    <Ionicons name="person" size={20} color={PRIMARY} />
                                </View>
                            )}
                            <View className="ml-3 flex-1">
                                <Text className="font-medium text-[14px] text-[#181A20]">
                                    {item.student?.name ?? `User #${item.user_id}`}
                                </Text>
                                <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                    {item.student?.matric_no ?? ''}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[11px] text-[#8F94A4]">Checked in</Text>
                                <Text className="font-medium text-[13px] text-[#181A20]">
                                    {new Date(item.checked_in_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            </View>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}
