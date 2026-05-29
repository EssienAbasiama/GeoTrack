import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { presenceApi } from '../services/apiClient';

type Props = NativeStackScreenProps<RootStackParamList, 'PresenceCheck'>;

const PRIMARY = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STRICT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function formatMs(ms: number): string {
    if (ms <= 0) return '0:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PresenceCheckScreen({ route, navigation }: Props) {
    const { checkId, courseCode, courseName, expiresAt } = route.params;
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);

    const expiresAtMs = useMemo(() => {
        if (expiresAt) {
            const t = new Date(expiresAt).getTime();
            if (!Number.isNaN(t)) return t;
        }
        return Date.now() + STRICT_TIMEOUT_MS;
    }, [expiresAt]);

    const [remaining, setRemaining] = useState(() => Math.max(0, expiresAtMs - Date.now()));
    const [submitting, setSubmitting] = useState(false);
    const [expired, setExpired] = useState(false);
    const [completed, setCompleted] = useState(false);
    const ringPulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const tick = setInterval(() => {
            const left = Math.max(0, expiresAtMs - Date.now());
            setRemaining(left);
            if (left <= 0) {
                setExpired(true);
                clearInterval(tick);
            }
        }, 500);
        return () => clearInterval(tick);
    }, [expiresAtMs]);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(ringPulse, {
                    toValue: 1.06,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(ringPulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const respond = async () => {
        if (expired || completed || submitting) return;
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({
                    type: 'error',
                    text1: 'Camera permission is required for this check.',
                    position: 'bottom',
                });
                return;
            }
        }
        setSubmitting(true);

        try {
            const locPerm = await Location.requestForegroundPermissionsAsync();
            if (locPerm.status !== 'granted') {
                Toast.show({
                    type: 'error',
                    text1: 'Location is required for presence check.',
                    position: 'bottom',
                });
                setSubmitting(false);
                return;
            }
            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const photo = await cameraRef.current?.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: true,
            });
            if (!photo?.base64) {
                Toast.show({
                    type: 'error',
                    text1: 'Could not capture selfie. Try again.',
                    position: 'bottom',
                });
                setSubmitting(false);
                return;
            }

            await presenceApi.respond(checkId, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? undefined,
                face_image_base64: photo.base64,
            });
            setCompleted(true);
            Toast.show({
                type: 'success',
                text1: 'Presence confirmed.',
                position: 'bottom',
            });
            setTimeout(() => navigation.goBack(), 1200);
        } catch (err) {
            const msg =
                (err as any)?.response?.data?.message ??
                'Presence check failed. Please try again.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setSubmitting(false);
        }
    };

    const renderStatus = () => {
        if (completed) {
            return (
                <View className="items-center px-6">
                    <View className="h-28 w-28 items-center justify-center rounded-full bg-[#E8F5E9] mb-6">
                        <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
                    </View>
                    <Text className="font-heading text-[22px] text-[#181A20]">Presence confirmed</Text>
                    <Text className="text-[13px] text-[#8F94A4] mt-2 text-center">
                        Thanks for verifying.
                    </Text>
                </View>
            );
        }
        if (expired) {
            return (
                <View className="items-center px-6">
                    <View className="h-28 w-28 items-center justify-center rounded-full bg-[#FFEBEE] mb-6">
                        <Ionicons name="time" size={56} color="#E53935" />
                    </View>
                    <Text className="font-heading text-[22px] text-[#181A20]">Check expired</Text>
                    <Text className="text-[13px] text-[#8F94A4] mt-2 text-center">
                        You did not respond within the 5-minute window. Your attendance
                        for this session may be revoked.
                    </Text>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="mt-8 h-12 px-6 items-center justify-center rounded-full bg-white border border-[#E7E8EE]"
                    >
                        <Text className="font-medium text-[14px] text-[#5B6070]">Close</Text>
                    </Pressable>
                </View>
            );
        }
        return null;
    };

    if (completed || expired) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                <View className="flex-1 items-center justify-center">{renderStatus()}</View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFEBEE] mr-3">
                        <MaterialCommunityIcons name="alert" size={20} color="#E53935" />
                    </View>
                    <View>
                        <Text className="font-heading text-[16px] text-[#181A20]">
                            Presence check
                        </Text>
                        <Text className="text-[12px] text-[#8F94A4]">
                            {courseCode} · {courseName}
                        </Text>
                    </View>
                </View>
                <View className="rounded-full bg-[#FFEBEE] px-3 py-1.5">
                    <Text className="font-medium text-[13px] text-[#E53935]">
                        {formatMs(remaining)}
                    </Text>
                </View>
            </View>

            <View className="flex-1 items-center px-5 pt-2">
                <Text className="text-[13px] text-[#5A5D6B] text-center leading-[20px]">
                    Your lecturer triggered a quick presence check. Take a selfie and confirm
                    your location to stay marked present.
                </Text>

                <View className="mt-6">
                    <Animated.View
                        style={{
                            transform: [{ scale: ringPulse }],
                        }}
                    >
                        <View
                            style={{
                                width: SCREEN_WIDTH * 0.7,
                                height: SCREEN_WIDTH * 0.88,
                                borderRadius: SCREEN_WIDTH * 0.35,
                                overflow: 'hidden',
                                borderWidth: 3,
                                borderColor: PRIMARY,
                                backgroundColor: '#000',
                            }}
                        >
                            {permission?.granted && (
                                <CameraView
                                    ref={(ref) => {
                                        cameraRef.current = ref;
                                    }}
                                    style={StyleSheet.absoluteFill}
                                    facing="front"
                                />
                            )}
                            <View style={styles.faceGuide}>
                                <View style={styles.faceOutline} />
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </View>

            <View className="px-5 pb-6">
                <Pressable
                    onPress={respond}
                    disabled={submitting}
                    className="h-12 items-center justify-center rounded-full bg-[#6343cc]"
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text className="font-medium text-[15px] text-white">
                            Confirm presence
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    faceGuide: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    faceOutline: {
        width: '72%',
        height: '60%',
        borderRadius: 1000,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderStyle: 'dashed',
    },
});
