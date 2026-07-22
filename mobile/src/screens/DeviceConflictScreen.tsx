import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { deviceApi } from '../services/apiClient';
import { useAuth } from '../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceConflict'>;

const PRIMARY = '#6343cc';

export function DeviceConflictScreen({ route, navigation }: Props) {
    const message =
        route.params?.message ??
        'This account is already linked to a different device. Please sign in from that device, or contact your administrator to reset access.';

    const { rebindDevice, signOut } = useAuth();
    const [resetting, setResetting] = useState(false);

    const handleReset = async () => {
        setResetting(true);
        try {
            await deviceApi.reset();
            const result = await rebindDevice();
            if (result.ok) {
                Toast.show({
                    type: 'success',
                    text1: 'Device reset and re-bound.',
                    position: 'bottom',
                });
                navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Could not bind this device. Try again later.',
                    position: 'bottom',
                });
            }
        } catch (err) {
            const msg =
                (err as any)?.response?.data?.message ??
                'Failed to reset device. Try again or contact your administrator.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setResetting(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'AuthLanding' }] });
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="flex-1 px-6 pt-6">
                <View className="flex-1 items-center justify-center">
                    <View className="h-24 w-24 items-center justify-center rounded-full bg-[#FFEBEE] mb-6">
                        <MaterialCommunityIcons name="cellphone-lock" size={48} color="#E53935" />
                    </View>

                    <Text className="font-heading text-[24px] text-[#181A20] text-center mb-3">
                        Device Conflict
                    </Text>
                    <Text className="text-[14px] text-[#5A5D6B] text-center leading-[22px] px-2">
                        {message}
                    </Text>

                    <View className="mt-8 rounded-[16px] bg-white px-4 py-4 w-full">
                        <View className="flex-row items-start">
                            <Ionicons name="information-circle" size={20} color={PRIMARY} />
                            <Text className="ml-3 flex-1 text-[12px] text-[#5A5D6B] leading-[18px]">
                                GeoTrack ties each account to one device to prevent proxy
                                check-ins. You can move your account to this phone below —
                                the old device will be unlinked, and the change is recorded
                                in your attendance log for your lecturer to see.
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="pb-6">
                    <Pressable
                        onPress={handleReset}
                        disabled={resetting}
                        className="h-12 items-center justify-center rounded-full bg-[#6343cc] mb-3"
                    >
                        {resetting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text className="font-medium text-[15px] text-white">
                                Use this device instead
                            </Text>
                        )}
                    </Pressable>

                    <Pressable
                        onPress={handleSignOut}
                        className="h-12 items-center justify-center rounded-full border border-[#E7E8EE] bg-white"
                    >
                        <Text className="font-medium text-[14px] text-[#5B6070]">Sign out</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
