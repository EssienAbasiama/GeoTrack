import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { LogoutBottomSheet } from '../components/LogoutBottomSheet';
import { useRole, ROLE_LABELS, ROLE_DESCRIPTIONS, UserRole } from '../store/RoleContext';
import { useAuth } from '../store/AuthContext';
import { deviceApi, faceApi } from '../services/apiClient';
import type { ApiDevice, ApiFaceProfile } from '../types/api';
import type { RootStackParamList } from '../types/navigation';

const PRIMARY_COLOR = '#6343cc';

const ROLE_OPTIONS: { value: UserRole; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }[] = [
    { value: 'student', icon: 'school', color: '#6343cc', bg: '#F0EDFC' },
    { value: 'lecturer', icon: 'person', color: '#2196F3', bg: '#E3F2FD' },
    { value: 'hoc', icon: 'people', color: '#FF9800', bg: '#FFF3E0' },
    { value: 'superadmin', icon: 'shield-checkmark', color: '#4CAF50', bg: '#E8F5E9' },
];

function MenuItem({
    icon,
    label,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            className="mb-2 flex-row items-center justify-between rounded-[14px] bg-[#F5F6FA] px-4 py-5"
        >
            <View className="flex-row items-center flex-1">
                <Ionicons name={icon} size={18} color="#8F94A4" />
                <Text className="ml-4 font-medium text-[15px] text-[#232736]">{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8F94A4" />
        </Pressable>
    );
}

export function ProfileScreen() {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [logoutVisible, setLogoutVisible] = useState(false);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const pulseScale = useRef(new Animated.Value(1)).current;
    const { role, setRole } = useRole();
    const { user, signOut, rebindDevice } = useAuth();

    const [device, setDevice] = useState<ApiDevice | null>(null);
    const [faceProfile, setFaceProfile] = useState<ApiFaceProfile | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [{ data: deviceData }, { data: faceData }] = await Promise.all([
                    deviceApi.me(),
                    faceApi.status(),
                ]);
                if (!mounted) return;
                setDevice(deviceData.devices?.[0] ?? null);
                setFaceProfile(faceData.profile);
            } catch {
                // best-effort
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleLogout = async () => {
        setLogoutVisible(false);
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'AuthLanding' }] });
    };

    const handleResetDevice = async () => {
        try {
            await deviceApi.reset();
            const result = await rebindDevice();
            if (result.ok) {
                setDevice(result.device);
                Toast.show({ type: 'success', text1: 'Device re-bound.', position: 'bottom' });
            } else if ('conflict' in result && result.conflict) {
                Toast.show({ type: 'error', text1: result.message, position: 'bottom' });
            } else {
                Toast.show({ type: 'error', text1: 'Could not re-bind device.', position: 'bottom' });
            }
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Reset failed.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    useEffect(() => {
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseScale, {
                    toValue: 1.1,
                    duration: 260,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseScale, {
                    toValue: 0.96,
                    duration: 180,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(pulseScale, {
                    toValue: 1,
                    speed: 16,
                    bounciness: 10,
                    useNativeDriver: true,
                }),
                Animated.delay(700),
            ])
        );

        pulseLoop.start();
        return () => pulseLoop.stop();
    }, [pulseScale]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#FFFFFF]">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 118 }}>
                <View className="mb-4 flex-row items-center justify-between">
                    <Pressable onPress={() => navigation.goBack()} className="h-9 w-9 items-center justify-center rounded-full bg-white">
                        <Ionicons name="chevron-back" size={20} color="#232736" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Profile</Text>
                    <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white">
                        <Ionicons name="ellipsis-vertical" size={20} color="#232736" />
                    </Pressable>
                </View>

                <View className="mb-6 flex-row items-center rounded-[16px] p-4 bg-[#f7f7fa]">
                    <Image
                        source={{ uri: 'https://randomuser.me/api/portraits/women/8.jpg' }}
                        style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }}
                    />
                    <View className="flex-1">
                        <Text className="font-heading text-[18px] text-[#181A20]">{user?.name ?? 'Welcome'}</Text>
                        <Text className="mt-1 text-[13px] text-[#8F94A4]">{user?.email ?? ''}</Text>
                    </View>
                    <Pressable className="ml-2 h-8 px-3 items-center justify-center rounded-lg bg-[#6343cc]/10">
                        <Ionicons name="pencil" size={16} color={PRIMARY_COLOR} />
                    </Pressable>
                </View>

                <Text className="mb-3 font-heading text-[16px] text-[#1F2230]">Security & Device</Text>

                <View className="mb-6 rounded-[16px] overflow-hidden">
                    <Pressable
                        onPress={() => navigation.navigate('FaceEnrollment')}
                        className="mb-2 flex-row items-center justify-between rounded-[14px] bg-[#F5F6FA] px-4 py-4"
                    >
                        <View className="flex-row items-center flex-1">
                            <MaterialCommunityIcons name="face-recognition" size={18} color="#8F94A4" />
                            <View className="ml-4 flex-1">
                                <Text className="font-medium text-[15px] text-[#232736]">Face profile</Text>
                                <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                    {faceProfile?.enrolled ? 'Enrolled' : 'Not enrolled'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#8F94A4" />
                    </Pressable>

                    <View className="mb-2 rounded-[14px] bg-[#F5F6FA] px-4 py-4">
                        <View className="flex-row items-center">
                            <Ionicons name="phone-portrait-outline" size={18} color="#8F94A4" />
                            <View className="ml-4 flex-1">
                                <Text className="font-medium text-[15px] text-[#232736]">Bound device</Text>
                                <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                    {device
                                        ? `${device.brand ?? ''} ${device.model ?? ''} · ${device.platform}`.trim()
                                        : 'No device on file'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Pressable
                        onPress={handleResetDevice}
                        className="flex-row items-center justify-between rounded-[14px] bg-[#FEEFEF] px-4 py-4"
                    >
                        <View className="flex-row items-center flex-1">
                            <Ionicons name="refresh" size={18} color="#cc4361" />
                            <Text className="ml-4 font-medium text-[15px] text-[#cc4361]">Reset device</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#cc4361" />
                    </Pressable>
                </View>

                <Text className="mb-3 font-heading text-[16px] text-[#1F2230]">Account</Text>

                <View className="mb-6 rounded-[16px] overflow-hidden">
                    <MenuItem icon="information-circle-outline" label="Account Information" />

                    <MenuItem icon="location-outline" label="Address Management" />

                    <MenuItem icon="lock-closed-outline" label="Password Manager" />
                </View>

                {/* Role Selector (Testing) */}
                <View className="mb-6 rounded-[20px] border-2 border-dashed border-[#FFB74D] bg-[#FFF8E1] p-4">
                    <View className="flex-row items-center mb-3">
                        <Ionicons name="flask" size={18} color="#FF9800" />
                        <Text className="ml-2 font-heading text-[16px] text-[#E65100]">Test Mode: Role Selector</Text>
                    </View>
                    <Text className="text-[12px] text-[#FF9800] mb-4">
                        Select a role to test different UI views. This will be removed in production.
                    </Text>

                    {ROLE_OPTIONS.map((option) => (
                        <Pressable
                            key={option.value}
                            onPress={() => setRole(option.value)}
                            className={`mb-2 flex-row items-center rounded-[14px] p-3 ${role === option.value ? 'border-2' : 'border border-[#E8EAF1] bg-white'
                                }`}
                            style={role === option.value ? { borderColor: option.color, backgroundColor: option.bg } : {}}
                        >
                            <View
                                className="h-10 w-10 items-center justify-center rounded-xl"
                                style={{ backgroundColor: role === option.value ? option.color + '20' : '#F5F6FA' }}
                            >
                                <Ionicons
                                    name={option.icon}
                                    size={20}
                                    color={role === option.value ? option.color : '#8F94A4'}
                                />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text
                                    className="font-medium text-[15px]"
                                    style={{ color: role === option.value ? option.color : '#232736' }}
                                >
                                    {ROLE_LABELS[option.value]}
                                </Text>
                                <Text className="text-[11px] text-[#8F94A4] mt-0.5">
                                    {ROLE_DESCRIPTIONS[option.value]}
                                </Text>
                            </View>
                            <View
                                className="h-6 w-6 rounded-full border-2 items-center justify-center"
                                style={{
                                    borderColor: role === option.value ? option.color : '#D6D9E3',
                                    backgroundColor: role === option.value ? option.color : 'transparent',
                                }}
                            >
                                {role === option.value && (
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                )}
                            </View>
                        </Pressable>
                    ))}
                </View>

                <Text className="mb-3 font-heading text-[16px] text-[#1F2230]">Notifications</Text>

                <View className="mb-5 flex-row items-center justify-between rounded-[16px] border border-[#E8EAF1] px-3 py-3">
                    <View className="mr-2 flex-1 flex-row items-center">
                        <Ionicons name="notifications-outline" size={18} color="#A8ADBB" />
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[15px] text-[#232736]">Push Notification</Text>
                            <Text className="mt-1 text-[12px] text-[#8F94A4]">Receive alerts on your device</Text>
                        </View>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View className="mb-5 flex-row items-center justify-between rounded-[16px] border border-[#E8EAF1] px-3 py-3">
                    <View className="mr-2 flex-1 flex-row items-center">
                        <MaterialCommunityIcons name="email-outline" size={18} color="#A8ADBB" />
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[15px] text-[#232736]">Email Notification</Text>
                            <Text className="mt-1 text-[12px] text-[#8F94A4]">Receive updates via email</Text>
                        </View>
                    </View>
                    <Switch
                        value={emailEnabled}
                        onValueChange={setEmailEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <Text className="mb-3 font-heading text-[16px] text-[#1F2230]">Support</Text>

                <View className="mb-3 rounded-[16px] overflow-hidden">
                    <MenuItem icon="help-circle-outline" label="Help Center" />
                    <View className="h-[1px] bg-[#E8EAF1]" />
                    <Pressable
                        onPress={() => setLogoutVisible(true)}
                        className="mb-1 flex-row items-center justify-between rounded-[14px] bg-[#F5F6FA] px-4 py-4"
                    >
                        <View className="flex-row items-center flex-1">
                            <Ionicons name="log-out-outline" size={18} color="#cc4361" />
                            <Text className="ml-4 font-medium text-[15px] text-[#cc4361]">Logout</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#8F94A4" />
                    </Pressable>
                </View>

                <LogoutBottomSheet
                    isVisible={logoutVisible}
                    onCancel={() => setLogoutVisible(false)}
                    onConfirm={handleLogout}
                />
            </ScrollView>

            <Animated.View style={{ position: 'absolute', right: 20, bottom: 100, transform: [{ scale: pulseScale }] }}>
                <Pressable className="h-14 w-14 items-center justify-center rounded-2xl bg-[#6343cc] shadow-lg shadow-[#4A34D7]/30">
                    <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    );
}
