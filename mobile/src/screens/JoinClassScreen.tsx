import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../store/AuthContext';
import { inviteApi } from '../services/apiClient';
import type { ApiClassInvite } from '../types/api';

const PRIMARY = '#6343cc';

export function JoinClassScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'JoinClass'>>();
    const { token } = route.params;
    const { isAuthenticated, setPendingInviteToken } = useAuth();

    const [invite, setInvite] = useState<ApiClassInvite | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    // Preview the invite once authenticated (the endpoint requires a token).
    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        let mounted = true;
        setLoading(true);
        inviteApi.get(token)
            .then(({ data }) => { if (mounted) setInvite(data.invite); })
            .catch((err) => {
                if (mounted) {
                    setError((err as any)?.response?.data?.message ?? 'This invite link is invalid or has expired.');
                }
            })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [isAuthenticated, token]);

    const isLecturerInvite = invite?.role === 'lecturer';
    const course = invite?.course;

    const handleSignIn = () => {
        setPendingInviteToken(token);
        navigation.navigate('Login');
    };

    const handleCreateAccount = () => {
        setPendingInviteToken(token);
        navigation.navigate('Register', { classCode: course?.code });
    };

    const handleAccept = async () => {
        setJoining(true);
        try {
            const { data } = await inviteApi.accept(token);
            Toast.show({
                type: 'success',
                text1: data.role === 'lecturer'
                    ? 'You are now the lecturer for this class.'
                    : 'You have joined the class.',
                position: 'bottom',
            });
            const c = data.course;
            navigation.reset({
                index: 0,
                routes: [
                    { name: 'MainTabs' },
                    {
                        name: 'ClassDetail',
                        params: {
                            classId: String(c.id),
                            classCode: c.code,
                            className: c.title ?? c.name ?? '',
                            venue: c.venue ?? '',
                            day: c.day ?? '',
                            startTime: c.start_time ?? '',
                            endTime: c.end_time ?? '',
                        },
                    },
                ],
            });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not join this class.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setJoining(false);
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-[#F6F6F9]">
            {/* Header */}
            <View className="px-5 pt-3 pb-2 flex-row items-center">
                <Pressable
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('MainTabs')}
                    className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
                >
                    <Ionicons name="arrow-back" size={20} color="#181A20" />
                </Pressable>
            </View>

            <View className="flex-1 px-6 justify-center">
                {loading ? (
                    <View className="items-center">
                        <ActivityIndicator size="large" color={PRIMARY} />
                        <Text className="mt-3 text-[14px] text-[#8F94A4]">Loading invite…</Text>
                    </View>
                ) : !isAuthenticated ? (
                    // ── Signed out: prompt to authenticate, token is remembered ──
                    <View className="items-center">
                        <View className="h-20 w-20 items-center justify-center rounded-[24px] bg-[#F0EDFC] mb-5">
                            <Ionicons name="school" size={38} color={PRIMARY} />
                        </View>
                        <Text className="font-heading text-[22px] text-[#181A20] text-center">You've been invited</Text>
                        <Text className="text-[14px] text-[#8F94A4] mt-2 text-center leading-[20px]">
                            Sign in or create an account to join this class on GeoTrack.
                        </Text>
                        <Pressable
                            onPress={handleSignIn}
                            className="mt-7 h-14 w-full items-center justify-center rounded-2xl bg-[#6343cc]"
                        >
                            <Text className="font-medium text-[16px] text-white">Sign in to continue</Text>
                        </Pressable>
                        <Pressable onPress={handleCreateAccount} className="mt-3 h-14 w-full items-center justify-center rounded-2xl bg-white border border-[#E8EAF1]">
                            <Text className="font-medium text-[16px] text-[#5A5D6B]">Create an account</Text>
                        </Pressable>
                    </View>
                ) : error ? (
                    // ── Invalid / expired ──
                    <View className="items-center">
                        <View className="h-20 w-20 items-center justify-center rounded-[24px] bg-[#FEECEC] mb-5">
                            <Ionicons name="alert-circle" size={40} color="#EF4444" />
                        </View>
                        <Text className="font-heading text-[20px] text-[#181A20] text-center">Invite unavailable</Text>
                        <Text className="text-[14px] text-[#8F94A4] mt-2 text-center leading-[20px]">{error}</Text>
                        <Pressable
                            onPress={() => navigation.replace('MainTabs')}
                            className="mt-7 h-14 w-full items-center justify-center rounded-2xl bg-[#F1F2F6]"
                        >
                            <Text className="font-medium text-[16px] text-[#5A5D6B]">Go home</Text>
                        </Pressable>
                    </View>
                ) : (
                    // ── Authenticated: preview + accept ──
                    <View className="items-center">
                        <View
                            className="h-20 w-20 items-center justify-center rounded-[24px] mb-5"
                            style={{ backgroundColor: isLecturerInvite ? '#E3F2FD' : '#E8F5E9' }}
                        >
                            <Ionicons
                                name={isLecturerInvite ? 'person' : 'people'}
                                size={38}
                                color={isLecturerInvite ? '#2196F3' : '#4CAF50'}
                            />
                        </View>
                        <Text className="text-[12px] text-[#8F94A4]">
                            {isLecturerInvite ? 'Lecturer assignment' : 'Class invitation'}
                        </Text>
                        <Text className="font-heading text-[24px] text-[#181A20] text-center mt-1">
                            {course?.code}
                        </Text>
                        <Text className="text-[15px] text-[#5A5D6B] mt-1 text-center">{course?.title}</Text>

                        <View className="mt-5 w-full rounded-[16px] bg-white p-4 shadow-sm shadow-black/5">
                            {course?.institution?.name ? (
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="business-outline" size={16} color="#8F94A4" />
                                    <Text className="ml-2 text-[13px] text-[#5A5D6B]">{course.institution.name}</Text>
                                </View>
                            ) : null}
                            {course?.venue ? (
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location-outline" size={16} color="#8F94A4" />
                                    <Text className="ml-2 text-[13px] text-[#5A5D6B]">{course.venue}</Text>
                                </View>
                            ) : null}
                            {course?.lecturer_name ? (
                                <View className="flex-row items-center">
                                    <Ionicons name="person-outline" size={16} color="#8F94A4" />
                                    <Text className="ml-2 text-[13px] text-[#5A5D6B]">{course.lecturer_name}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text className="text-[13px] text-[#8F94A4] mt-4 text-center leading-[19px]">
                            {isLecturerInvite
                                ? 'Accepting will assign you as the lecturer for this class.'
                                : 'Accepting will add you as a member of this class.'}
                        </Text>

                        <Pressable
                            onPress={handleAccept}
                            disabled={joining}
                            className="mt-5 h-14 w-full items-center justify-center rounded-2xl bg-[#6343cc]"
                            style={{ opacity: joining ? 0.7 : 1 }}
                        >
                            {joining ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="font-medium text-[16px] text-white">
                                    {isLecturerInvite ? 'Become Lecturer' : 'Join Class'}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
