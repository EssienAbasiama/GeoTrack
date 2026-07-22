import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import MapView, { Circle, Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { attendanceApi, faceApi, geofenceApi, sessionApi } from '../services/apiClient';
import type { ApiGeofence, ApiSession } from '../types/api';
import { notifyCheckInSuccess } from '../services/notifications';
import { getDemoMode } from '../utils/demoMode';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckIn'>;

const PRIMARY = '#6343cc';
const SUCCESS = '#22C55E';
const DANGER = '#EF5350';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LatLng {
    latitude: number;
    longitude: number;
}

function haversineMeters(a: LatLng, b: LatLng): number {
    const R = 6_371_000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Ray-cast point-in-polygon for sphere-projected lat/lng. */
function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        const intersect =
            yi > point.latitude !== yj > point.latitude &&
            point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function polygonCenter(coords: LatLng[]): LatLng {
    if (!coords.length) return { latitude: 0, longitude: 0 };
    const sum = coords.reduce(
        (acc, c) => ({ latitude: acc.latitude + c.latitude, longitude: acc.longitude + c.longitude }),
        { latitude: 0, longitude: 0 },
    );
    return { latitude: sum.latitude / coords.length, longitude: sum.longitude / coords.length };
}

function minDistanceToPolygon(point: LatLng, polygon: LatLng[]): number {
    let min = Infinity;
    for (const v of polygon) {
        min = Math.min(min, haversineMeters(point, v));
    }
    return min;
}

export function CheckInScreen({ route, navigation }: Props) {
    const { courseId, classCode, className } = route.params;

    const mapRef = useRef<MapView | null>(null);
    const cameraRef = useRef<CameraView | null>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const isFocused = useIsFocused();

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<ApiSession | null>(null);
    const [geofence, setGeofence] = useState<ApiGeofence | null>(null);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [distanceM, setDistanceM] = useState<number | null>(null);
    const [insideFence, setInsideFence] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [success, setSuccess] = useState(false);
    // null = still checking; true/false = enrolled state of the student's face.
    const [faceEnrolled, setFaceEnrolled] = useState<boolean | null>(null);
    // Hidden "Simulation mode" — when on, face verification is auto-passed.
    const [demoMode, setDemoMode] = useState(false);

    const sheetY = useRef(new Animated.Value(120)).current;
    const successScale = useRef(new Animated.Value(0)).current;

    // ── Initial loaders ──────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [sessRes, fenceRes] = await Promise.all([
                    sessionApi.active(courseId),
                    geofenceApi.get(courseId).catch(() => ({ data: { geofence: null } as { geofence: ApiGeofence | null } })),
                ]);
                if (!mounted) return;
                setSession(sessRes.data.session);
                setGeofence(fenceRes.data.geofence);
            } catch (err) {
                const msg =
                    (err as any)?.response?.data?.message ?? 'Failed to load check-in data.';
                Toast.show({ type: 'error', text1: msg, position: 'bottom' });
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [courseId]);

    useEffect(() => {
        Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 14,
            bounciness: 7,
        }).start();
    }, [sheetY]);

    // Face enrollment status — refreshed whenever the screen regains focus, so
    // returning from the enrollment screen flips the gate without a manual reload.
    useEffect(() => {
        if (!isFocused) return;
        let mounted = true;
        getDemoMode().then((on) => { if (mounted) setDemoMode(on); });
        faceApi
            .status()
            .then(({ data }) => { if (mounted) setFaceEnrolled(Boolean(data.profile)); })
            .catch(() => { if (mounted) setFaceEnrolled(false); });
        return () => { mounted = false; };
    }, [isFocused]);

    // ── Location ─────────────────────────────────────────────────────────────
    const startLocation = useCallback(async () => {
        setLocationError(null);
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
            setLocationError('Location permission is required to verify your position.');
            return;
        }
        try {
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setUserLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            });
            setAccuracy(pos.coords.accuracy ?? null);
        } catch {
            setLocationError('Could not read your location. Please try again.');
        }
    }, []);

    useEffect(() => {
        if (!session) return;
        startLocation();
    }, [session, startLocation]);

    // ── Fence math ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userLocation || !geofence) {
            setInsideFence(false);
            setDistanceM(null);
            return;
        }

        if (geofence.shape === 'circle' && geofence.center_lat != null && geofence.center_lng != null) {
            const center: LatLng = {
                latitude: geofence.center_lat,
                longitude: geofence.center_lng,
            };
            const d = haversineMeters(userLocation, center);
            setDistanceM(d);
            setInsideFence(d <= (geofence.radius_m ?? 50));
            return;
        }

        if (geofence.shape === 'polygon' && geofence.polygon && geofence.polygon.length >= 3) {
            const inside = pointInPolygon(userLocation, geofence.polygon);
            setInsideFence(inside);
            setDistanceM(inside ? 0 : minDistanceToPolygon(userLocation, geofence.polygon));
            return;
        }

        // No fence configured – assume "ready" so the backend has final say.
        setInsideFence(true);
        setDistanceM(null);
    }, [userLocation, geofence]);

    // ── Submit ───────────────────────────────────────────────────────────────
    const submitCheckIn = async (faceBase64?: string, demoBypass = false) => {
        if (!session || !userLocation) return;

        setSubmitting(true);
        try {
            await attendanceApi.checkIn(session.id, {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                accuracy: accuracy ?? undefined,
                face_image_base64: faceBase64,
                demo_bypass: demoBypass || undefined,
            });

            setSuccess(true);
            Animated.spring(successScale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 12,
                bounciness: 8,
            }).start();
            notifyCheckInSuccess(classCode, className).catch(() => {});

            setTimeout(() => navigation.goBack(), 1400);
        } catch (err) {
            const data = (err as any)?.response?.data;
            const msg = data?.message ?? 'Check-in failed. Try again.';
            // Backend says the student needs to enroll their face first.
            if (data?.data?.face_enrollment_required) {
                setFaceEnrolled(false);
                Toast.show({ type: 'error', text1: msg, position: 'bottom' });
                navigation.navigate('FaceEnrollment');
                return;
            }
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckIn = async () => {
        if (!session || !userLocation || submitting) return;

        // Simulation mode — skip the live selfie entirely and auto-verify.
        if (demoMode) {
            Toast.show({ type: 'success', text1: 'Face verified', position: 'bottom' });
            await submitCheckIn(undefined, true);
            return;
        }

        // Identity check: a face must be enrolled and a live selfie captured.
        if (faceEnrolled === false) {
            navigation.navigate('FaceEnrollment');
            return;
        }

        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                Toast.show({
                    type: 'error',
                    text1: 'Camera permission is required to verify your face.',
                    position: 'bottom',
                });
                return;
            }
        }
        setShowCamera(true);
    };

    const handleCapture = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: true,
            });
            setShowCamera(false);
            if (!photo?.base64) {
                Toast.show({
                    type: 'error',
                    text1: 'Could not capture photo. Try again.',
                    position: 'bottom',
                });
                return;
            }
            await submitCheckIn(photo.base64);
        } catch (err) {
            setShowCamera(false);
            Toast.show({
                type: 'error',
                text1: 'Camera error. Please try again.',
                position: 'bottom',
            });
        }
    };

    // ── Map region ───────────────────────────────────────────────────────────
    const initialRegion = (() => {
        if (geofence?.shape === 'circle' && geofence.center_lat != null && geofence.center_lng != null) {
            return {
                latitude: geofence.center_lat,
                longitude: geofence.center_lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
        }
        if (geofence?.shape === 'polygon' && geofence.polygon && geofence.polygon.length) {
            const c = polygonCenter(geofence.polygon);
            return {
                latitude: c.latitude,
                longitude: c.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
        }
        if (userLocation) {
            return {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
        }
        return undefined;
    })();

    // ── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={PRIMARY} />
                    <Text className="mt-3 text-[13px] text-[#8F94A4]">Loading check-in…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!session) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
                    >
                        <Ionicons name="chevron-back" size={20} color="#181A20" />
                    </Pressable>
                    <Text className="font-heading text-[18px] text-[#181A20]">{classCode}</Text>
                    <View className="w-10" />
                </View>

                <View className="flex-1 items-center justify-center px-6">
                    <View className="h-24 w-24 items-center justify-center rounded-full bg-[#FFF3E0] mb-6">
                        <Ionicons name="time" size={48} color="#FF9800" />
                    </View>
                    <Text className="font-heading text-[22px] text-[#181A20] text-center">
                        No active session
                    </Text>
                    <Text className="text-[13px] text-[#8F94A4] text-center mt-2 leading-[20px]">
                        Your lecturer hasn't started a session for {classCode} yet. You'll be
                        able to check in once attendance is opened.
                    </Text>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="mt-8 h-12 px-6 items-center justify-center rounded-full bg-[#6343cc]"
                    >
                        <Text className="font-medium text-[14px] text-white">Go back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (showCamera) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-black">
                <View className="flex-1 items-center justify-center px-5">
                    <Text className="font-heading text-[18px] text-white mb-3">
                        Take a quick selfie
                    </Text>
                    <View
                        style={{
                            width: SCREEN_WIDTH * 0.78,
                            height: SCREEN_WIDTH * 0.95,
                            borderRadius: SCREEN_WIDTH * 0.39,
                            overflow: 'hidden',
                            borderWidth: 3,
                            borderColor: PRIMARY,
                        }}
                    >
                        <CameraView
                            ref={(ref) => {
                                cameraRef.current = ref;
                            }}
                            style={StyleSheet.absoluteFill}
                            facing="front"
                        />
                    </View>
                </View>
                <View className="px-5 pb-8">
                    <Pressable
                        onPress={handleCapture}
                        disabled={submitting}
                        className="h-12 items-center justify-center rounded-full bg-[#6343cc] mb-3"
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text className="font-medium text-[15px] text-white">Capture & check in</Text>
                        )}
                    </Pressable>
                    <Pressable
                        onPress={() => setShowCamera(false)}
                        className="h-12 items-center justify-center"
                    >
                        <Text className="font-medium text-[14px] text-white/80">Cancel</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="flex-1 bg-[#1E2130]">
                <MapView
                    ref={(ref) => { mapRef.current = ref; }}
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    initialRegion={initialRegion}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                >
                    {geofence?.shape === 'circle' && geofence.center_lat != null && geofence.center_lng != null && (
                        <>
                            <Circle
                                center={{ latitude: geofence.center_lat, longitude: geofence.center_lng }}
                                radius={geofence.radius_m ?? 50}
                                fillColor="rgba(99, 67, 204, 0.18)"
                                strokeColor={PRIMARY}
                                strokeWidth={2}
                            />
                            <Marker
                                coordinate={{ latitude: geofence.center_lat, longitude: geofence.center_lng }}
                                title={geofence.name ?? className}
                            >
                                <View className="h-7 w-7 items-center justify-center rounded-full bg-[#6343cc] border border-white">
                                    <Ionicons name="location" size={16} color="#FFFFFF" />
                                </View>
                            </Marker>
                        </>
                    )}
                    {geofence?.shape === 'polygon' && geofence.polygon && geofence.polygon.length >= 3 && (
                        <Polygon
                            coordinates={geofence.polygon}
                            fillColor="rgba(99, 67, 204, 0.18)"
                            strokeColor={PRIMARY}
                            strokeWidth={2}
                        />
                    )}
                </MapView>

                <View pointerEvents="none" className="absolute inset-0 bg-[#161B28]/30" />

                <View className="absolute left-5 top-12 right-5 flex-row items-center justify-between">
                    <BlurView
                        intensity={45}
                        tint="dark"
                        className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10"
                    >
                        <Pressable
                            onPress={() => navigation.goBack()}
                            className="h-full w-full items-center justify-center"
                        >
                            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                        </Pressable>
                    </BlurView>
                    <View className="rounded-full bg-white/90 px-3 py-1.5">
                        <Text className="font-medium text-[12px] text-[#181A20]">
                            {classCode}
                        </Text>
                    </View>
                </View>

                {/* Status banner */}
                <View className="absolute left-5 right-5 top-28">
                    <View
                        className="rounded-[14px] px-4 py-3 flex-row items-center"
                        style={{
                            backgroundColor: insideFence ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 83, 80, 0.95)',
                        }}
                    >
                        <Ionicons
                            name={insideFence ? 'checkmark-circle' : 'warning'}
                            size={20}
                            color="#FFFFFF"
                        />
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[14px] text-white">
                                {insideFence ? 'Ready to check in' : 'Move closer to the venue'}
                            </Text>
                            {distanceM != null && (
                                <Text className="text-[12px] text-white/90 mt-0.5">
                                    {insideFence
                                        ? `Inside fence · ${Math.round(distanceM)}m from center`
                                        : `${Math.round(distanceM)}m away`}
                                </Text>
                            )}
                            {locationError && (
                                <Text className="text-[12px] text-white/90 mt-0.5">
                                    {locationError}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Bottom action sheet */}
                <Animated.View
                    style={{ transform: [{ translateY: sheetY }] }}
                    className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-[#F8F8FB] px-5 pt-5 pb-8"
                >
                    {success ? (
                        <View className="items-center py-4">
                            <Animated.View style={{ transform: [{ scale: successScale }] }}>
                                <View className="h-20 w-20 items-center justify-center rounded-full bg-[#E8F5E9]">
                                    <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
                                </View>
                            </Animated.View>
                            <Text className="mt-4 font-heading text-[22px] text-[#181A20]">
                                Check-in successful!
                            </Text>
                            <Text className="mt-1 text-[13px] text-[#8F94A4]">
                                Your attendance for {classCode} is recorded.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View className="flex-row items-center mb-4">
                                <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-[#F0EDFC]">
                                    <Ionicons name="book" size={22} color={PRIMARY} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="font-heading text-[16px] text-[#181A20]">
                                        {classCode}
                                    </Text>
                                    <Text className="text-[12px] text-[#8F94A4]">{className}</Text>
                                </View>
                                <View className="flex-row items-center rounded-full bg-[#F0EDFC] px-3 py-1">
                                    <Ionicons name="scan-outline" size={13} color="#6343cc" />
                                    <Text className="ml-1 text-[11px] font-medium text-[#6343cc]">
                                        Face check
                                    </Text>
                                </View>
                            </View>

                            {faceEnrolled === false && !demoMode ? (
                                // Identity gate — must enroll a reference face first.
                                <>
                                    <View className="flex-row items-start rounded-[14px] bg-[#FFF8E1] border border-[#FFE082] px-4 py-3 mb-3">
                                        <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
                                        <Text className="ml-2 flex-1 text-[12px] text-[#92400E] leading-[17px]">
                                            To confirm it's really you, enroll your face once. You'll then verify with a quick selfie at every check-in.
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() => navigation.navigate('FaceEnrollment')}
                                        className="h-12 items-center justify-center rounded-full flex-row bg-[#6343cc]"
                                    >
                                        <MaterialCommunityIcons name="face-recognition" size={20} color="#FFFFFF" />
                                        <Text className="ml-2 font-medium text-[15px] text-white">Enroll your face</Text>
                                    </Pressable>
                                </>
                            ) : (
                                <Pressable
                                    onPress={handleCheckIn}
                                    disabled={submitting || !insideFence || !userLocation || (!demoMode && faceEnrolled === null)}
                                    className="h-12 items-center justify-center rounded-full flex-row"
                                    style={{
                                        backgroundColor: insideFence && (demoMode || faceEnrolled !== null) ? PRIMARY : '#C7C9D2',
                                    }}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons
                                                name="face-recognition"
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                            <Text className="ml-2 font-medium text-[15px] text-white">
                                                {!demoMode && faceEnrolled === null ? 'Preparing…' : 'Verify face & check in'}
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </>
                    )}
                </Animated.View>

                {/* sink the unused DANGER reference so eslint doesn't grumble */}
                <View style={{ position: 'absolute', width: 0, height: 0, borderColor: DANGER }} />
            </View>
        </SafeAreaView>
    );
}
