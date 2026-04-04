import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckIn'>;

const PRIMARY = '#6343cc';
const MAP_BG = '#1E2130';

type LatLng = {
    latitude: number;
    longitude: number;
};

const DESTINATION: LatLng = {
    latitude: 5.0387,
    longitude: 7.9123,
};

const DEFAULT_CENTER: LatLng = {
    latitude: 5.0412,
    longitude: 7.9289,
};

function formatDistanceFromMeters(meters: number): string {
    const miles = meters / 1609.344;
    if (miles >= 0.1) return `${miles.toFixed(1)} mi`;
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
}

function formatDurationFromSeconds(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
}

function decodePolyline(encoded: string): LatLng[] {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: LatLng[] = [];

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        });
    }

    return coordinates;
}

export function CheckInScreen({ navigation }: Props) {
    const [step, setStep] = useState<'permission' | 'route'>('permission');
    const [locationPoint, setLocationPoint] = useState<LatLng | null>(null);
    const [routePoints, setRoutePoints] = useState<LatLng[]>([]);
    const [distanceText, setDistanceText] = useState('--');
    const [durationText, setDurationText] = useState('--');
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [locationError, setLocationError] = useState('');
    const sheetY = useRef(new Animated.Value(140)).current;
    const mapFade = useRef(new Animated.Value(0)).current;
    const mapRef = useRef<MapView | null>(null);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(mapFade, {
                toValue: 1,
                duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(sheetY, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 7,
            }),
        ]).start();
    }, [mapFade, sheetY]);

    const fitMapToRoute = (origin: LatLng, destination: LatLng) => {
        mapRef.current?.fitToCoordinates([origin, destination], {
            edgePadding: { top: 120, right: 60, left: 60, bottom: 260 },
            animated: true,
        });
    };

    const fetchRoute = async (origin: LatLng, destination: LatLng) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
            const response = await fetch(url);
            const data = await response.json();

            const route = data?.routes?.[0];
            const points = route?.geometry as string | undefined;

            if (points) {
                setRoutePoints(decodePolyline(points));
            } else {
                setRoutePoints([origin, destination]);
            }

            if (typeof route?.distance === 'number') {
                setDistanceText(formatDistanceFromMeters(route.distance));
            } else {
                setDistanceText('~0.8 mi');
            }

            if (typeof route?.duration === 'number') {
                setDurationText(formatDurationFromSeconds(route.duration));
            } else {
                setDurationText('~9 min');
            }
        } catch {
            setRoutePoints([origin, destination]);
            setDistanceText('~0.8 mi');
            setDurationText('~9 min');
        }
    };

    const requestLocationAndRoute = async () => {
        setLocationError('');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
            setLocationError('Location permission is required for guided check-in routing.');
            return;
        }

        setIsLoadingRoute(true);
        try {
            const currentPosition = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const origin = {
                latitude: currentPosition.coords.latitude,
                longitude: currentPosition.coords.longitude,
            };

            setLocationPoint(origin);
            await fetchRoute(origin, DESTINATION);
            showRoutePreview();
            setTimeout(() => fitMapToRoute(origin, DESTINATION), 120);
        } catch {
            setLocationError('Unable to get your current location. Please try again.');
        } finally {
            setIsLoadingRoute(false);
        }
    };

    const showRoutePreview = () => {
        Animated.timing(sheetY, {
            toValue: 40,
            duration: 180,
            useNativeDriver: true,
        }).start(() => {
            setStep('route');
            Animated.spring(sheetY, {
                toValue: 0,
                useNativeDriver: true,
                speed: 16,
                bounciness: 8,
            }).start();
        });
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <Animated.View style={{ flex: 1, opacity: mapFade }}>
                <View className="flex-1" style={{ backgroundColor: MAP_BG }}>
                    <MapView
                        ref={(ref) => {
                            mapRef.current = ref;
                        }}
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: DEFAULT_CENTER.latitude,
                            longitude: DEFAULT_CENTER.longitude,
                            latitudeDelta: 0.025,
                            longitudeDelta: 0.02,
                        }}
                        showsUserLocation={step === 'route'}
                        showsMyLocationButton={false}
                        showsCompass={false}
                    >
                        <Marker coordinate={DESTINATION} title="Engineering Block">
                            <View className="h-7 w-7 items-center justify-center rounded-full bg-[#6343cc] border border-white">
                                <Ionicons name="location" size={16} color="#FFFFFF" />
                            </View>
                        </Marker>

                        {locationPoint ? (
                            <Marker coordinate={locationPoint} title="Your location">
                                <View className="h-4 w-4 rounded-full border-2 border-white bg-[#AFA2F2]" />
                            </Marker>
                        ) : null}

                        {routePoints.length > 1 ? (
                            <Polyline
                                coordinates={routePoints}
                                strokeColor="#F0D75A"
                                strokeWidth={5}
                                lineCap="round"
                                lineJoin="round"
                            />
                        ) : null}
                    </MapView>

                    <View pointerEvents="none" className="absolute inset-0 bg-[#161B28]/32" />

                    <View className="absolute left-8 top-12 right-8 flex-row items-center justify-between">
                        <BlurView intensity={45} tint="dark" className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10">
                            <Pressable
                                onPress={() => navigation.goBack()}
                                className="h-full w-full items-center justify-center"
                            >
                                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                            </Pressable>
                        </BlurView>
                        <BlurView intensity={45} tint="dark" className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10">
                            <Pressable className="h-full w-full items-center justify-center">
                                <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                            </Pressable>
                        </BlurView>
                    </View>

                    <Animated.View
                        style={{
                            transform: [{ translateY: sheetY }],
                        }}
                        className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-[#F8F8FB] px-5 pt-5 pb-8"
                    >
                        {step === 'permission' ? (
                            <>
                                <View className="items-center">
                                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EEEAFD]">
                                        <Ionicons name="location-outline" size={24} color={PRIMARY} />
                                    </View>
                                    <Text className="mt-4 font-heading text-[24px] text-[#181A20]">Enable Location Access</Text>
                                    <Text className="mt-2 px-4 text-center text-[13px] text-[#8F93A3]">
                                        Use your current location to validate and complete your class check-in.
                                    </Text>
                                </View>

                                <Pressable
                                    onPress={requestLocationAndRoute}
                                    disabled={isLoadingRoute}
                                    className="mt-6 h-12 items-center justify-center rounded-full bg-[#6343cc]"
                                >
                                    {isLoadingRoute ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text className="font-medium text-[15px] text-white">Use My Location</Text>
                                    )}
                                </Pressable>

                                {locationError ? (
                                    <Text className="mt-3 text-center text-[12px] text-[#D94E4E]">{locationError}</Text>
                                ) : null}

                                <Pressable
                                    onPress={() => navigation.goBack()}
                                    className="mt-3 h-12 items-center justify-center rounded-full border border-[#E7E8EE] bg-white"
                                >
                                    <Text className="font-medium text-[14px] text-[#5B6070]">Skip for now</Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <View className="mb-3 flex-row items-center justify-between">
                                    <View>
                                        <Text className="font-heading text-[20px] text-[#181A20]">Check-In Route</Text>
                                        <Text className="mt-1 text-[12px] text-[#8F93A3]">Distance {distanceText} • ETA {durationText}</Text>
                                    </View>
                                    <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
                                        <Ionicons name="ellipsis-horizontal" size={20} color="#8F93A3" />
                                    </View>
                                </View>

                                <View className="rounded-[16px] bg-white px-4 py-4">
                                    <View className="flex-row items-center justify-between">
                                        <View>
                                            <Text className="text-[12px] text-[#8F93A3]">Start</Text>
                                            <Text className="mt-1 font-medium text-[14px] text-[#181A20]">Campus Gate</Text>
                                        </View>
                                        <View>
                                            <Text className="text-right text-[12px] text-[#8F93A3]">Destination</Text>
                                            <Text className="mt-1 font-medium text-[14px] text-[#181A20]">Engineering Block</Text>
                                        </View>
                                    </View>
                                </View>

                                <Pressable className="mt-5 h-12 items-center justify-center rounded-full bg-[#6343cc]">
                                    <Text className="font-medium text-[15px] text-white">Start Check-In</Text>
                                </Pressable>
                            </>
                        )}
                    </Animated.View>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}
