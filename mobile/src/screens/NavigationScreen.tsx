import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import MapView, { Marker, Polyline, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Point-in-polygon algorithm (ray casting)
function isPointInPolygon(
    point: { latitude: number; longitude: number },
    polygon: { latitude: number; longitude: number }[]
): boolean {
    if (polygon.length < 3) return false;

    let inside = false;
    const x = point.longitude;
    const y = point.latitude;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
}

// Haversine formula for distance calculation
function getDistanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Estimate walking time (average 5 km/h = 83.3 m/min)
function estimateWalkingTime(distanceMeters: number): number {
    return Math.ceil(distanceMeters / 83.3);
}

// Format distance
function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

export function NavigationScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Navigation'>>();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const { destination, classCode, className, polygonCoords } = route.params;

    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInsideGeofence, setIsInsideGeofence] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);
    const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
    const [heading, setHeading] = useState<number>(0);
    const [isTracking, setIsTracking] = useState(true);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Start pulse animation for user marker
    useEffect(() => {
        const pulse = () => {
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 1000,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start(() => pulse());
        };
        pulse();

        // Slide in bottom card
        Animated.timing(slideAnim, {
            toValue: 1,
            duration: 500,
            delay: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    // Watch user location
    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        const startTracking = async () => {
            try {
                // Use permission utility with proper denial handling
                const hasPermission = await ensureLocationPermission(() => {
                    navigation.goBack();
                });

                if (!hasPermission) {
                    setIsLoading(false);
                    return;
                }

                // Get initial location
                const initialLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                const initialCoords = {
                    latitude: initialLocation.coords.latitude,
                    longitude: initialLocation.coords.longitude,
                };

                setUserLocation(initialCoords);
                updateDistanceAndRoute(initialCoords);
                setIsLoading(false);

                // Start watching location
                locationSubscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 2000,
                        distanceInterval: 5,
                    },
                    (location) => {
                        const newCoords = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        };
                        setUserLocation(newCoords);
                        setHeading(location.coords.heading || 0);
                        updateDistanceAndRoute(newCoords);

                        // Check if inside geofence
                        if (polygonCoords && polygonCoords.length >= 3) {
                            const inside = isPointInPolygon(newCoords, polygonCoords);
                            setIsInsideGeofence(inside);
                        }

                        // Center map on user if tracking
                        if (isTracking && mapRef.current) {
                            mapRef.current.animateToRegion(
                                {
                                    latitude: newCoords.latitude,
                                    longitude: newCoords.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                },
                                500
                            );
                        }
                    }
                );
            } catch (error) {
                console.error('Error starting location tracking:', error);
                setIsLoading(false);
            }
        };

        startTracking();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [destination, isTracking]);

    const updateDistanceAndRoute = useCallback(
        (currentLocation: { latitude: number; longitude: number }) => {
            // Calculate distance to destination
            const dist = getDistanceInMeters(
                currentLocation.latitude,
                currentLocation.longitude,
                destination.latitude,
                destination.longitude
            );
            setDistance(dist);
            setEstimatedTime(estimateWalkingTime(dist));

            // Create a simple route (straight line for now)
            // In production, you would use Google Directions API
            setRouteCoordinates([currentLocation, destination]);
        },
        [destination]
    );

    const centerOnUser = () => {
        if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion(
                {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                },
                500
            );
            setIsTracking(true);
        }
    };

    const fitToRoute = () => {
        if (mapRef.current && userLocation) {
            mapRef.current.fitToCoordinates(
                [userLocation, destination],
                {
                    edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
                    animated: true,
                }
            );
            setIsTracking(false);
        }
    };

    const handleMapDrag = () => {
        setIsTracking(false);
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-[#F6F6F9] items-center justify-center">
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text className="text-[15px] text-[#5A5D6B] mt-4">Getting your location...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#F6F6F9]">
            {/* Map */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                    latitude: userLocation?.latitude || destination.latitude,
                    longitude: userLocation?.longitude || destination.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                onPanDrag={handleMapDrag}
                showsCompass={false}
                showsMyLocationButton={false}
            >
                {/* Route Line */}
                {routeCoordinates.length >= 2 && (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={PRIMARY_COLOR}
                        strokeWidth={5}
                        lineDashPattern={[1]}
                    />
                )}

                {/* Geofence Polygon */}
                {polygonCoords && polygonCoords.length >= 3 && (
                    <Polygon
                        coordinates={polygonCoords}
                        fillColor={isInsideGeofence ? 'rgba(76, 175, 80, 0.2)' : 'rgba(99, 67, 204, 0.15)'}
                        strokeColor={isInsideGeofence ? '#4CAF50' : PRIMARY_COLOR}
                        strokeWidth={3}
                    />
                )}

                {/* Destination Marker */}
                <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
                    <View style={styles.destinationMarker}>
                        <View style={styles.destinationMarkerInner}>
                            <Ionicons name="school" size={20} color="#fff" />
                        </View>
                        <View style={styles.destinationMarkerTail} />
                    </View>
                </Marker>

                {/* User Location Marker */}
                {userLocation && (
                    <Marker
                        coordinate={userLocation}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat
                        rotation={heading}
                    >
                        <View style={styles.userMarkerContainer}>
                            <Animated.View
                                style={[
                                    styles.userMarkerPulse,
                                    { transform: [{ scale: pulseAnim }] },
                                ]}
                            />
                            <View style={styles.userMarker}>
                                <View style={styles.userMarkerArrow} />
                            </View>
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* Header */}
            <SafeAreaView edges={['top']} style={styles.header}>
                <View className="flex-row items-center px-4 py-2">
                    <Pressable
                        onPress={() => navigation.goBack()}
                        className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm shadow-black/10"
                    >
                        <Ionicons name="arrow-back" size={22} color="#181A20" />
                    </Pressable>
                    <View className="flex-1 mx-3">
                        <Text className="font-heading text-[16px] text-[#181A20]" numberOfLines={1}>
                            Navigating to {classCode}
                        </Text>
                        <Text className="text-[12px] text-[#8F94A4]" numberOfLines={1}>
                            {className}
                        </Text>
                    </View>
                    <Pressable
                        onPress={fitToRoute}
                        className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm shadow-black/10"
                    >
                        <MaterialIcons name="zoom-out-map" size={22} color="#5A5D6B" />
                    </Pressable>
                </View>
            </SafeAreaView>

            {/* Recenter Button */}
            {!isTracking && (
                <Pressable
                    onPress={centerOnUser}
                    style={[styles.recenterButton, { bottom: 280 }]}
                >
                    <MaterialIcons name="my-location" size={24} color={PRIMARY_COLOR} />
                </Pressable>
            )}

            {/* Bottom Card */}
            <Animated.View
                style={[
                    styles.bottomCard,
                    {
                        paddingBottom: Math.max(insets.bottom, 20),
                        transform: [
                            {
                                translateY: slideAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [200, 0],
                                }),
                            },
                        ],
                    },
                ]}
            >
                {/* Status Banner */}
                {isInsideGeofence ? (
                    <View className="bg-[#4CAF50] rounded-t-[24px] px-5 py-3 flex-row items-center justify-center">
                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                        <Text className="ml-2 font-heading text-[15px] text-white">
                            You've arrived at the class location!
                        </Text>
                    </View>
                ) : (
                    <View className="bg-[#6343cc] rounded-t-[24px] px-5 py-3 flex-row items-center justify-center">
                        <MaterialCommunityIcons name="navigation-variant" size={22} color="#fff" />
                        <Text className="ml-2 font-heading text-[15px] text-white">
                            {estimatedTime ? `${estimatedTime} min walk` : 'Calculating...'}
                        </Text>
                    </View>
                )}

                <View className="bg-white px-5 py-4 rounded-b-[24px]">
                    {/* Distance Info */}
                    <View className="flex-row items-center mb-4">
                        <View className="flex-1 items-center">
                            <View className="flex-row items-center">
                                <MaterialIcons name="straighten" size={20} color="#8F94A4" />
                                <Text className="ml-2 font-heading text-[24px] text-[#181A20]">
                                    {distance ? formatDistance(distance) : '--'}
                                </Text>
                            </View>
                            <Text className="text-[12px] text-[#8F94A4] mt-1">Distance</Text>
                        </View>
                        <View className="w-[1px] h-10 bg-[#E8EAF1]" />
                        <View className="flex-1 items-center">
                            <View className="flex-row items-center">
                                <Ionicons name="walk" size={20} color="#8F94A4" />
                                <Text className="ml-2 font-heading text-[24px] text-[#181A20]">
                                    {estimatedTime ? `${estimatedTime}` : '--'}
                                </Text>
                                <Text className="text-[14px] text-[#8F94A4] ml-1">min</Text>
                            </View>
                            <Text className="text-[12px] text-[#8F94A4] mt-1">Est. Time</Text>
                        </View>
                    </View>

                    {/* Destination Info */}
                    <View className="flex-row items-center p-3 rounded-[14px] bg-[#F6F6F9] mb-4">
                        <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#F0EDFC]">
                            <Ionicons name="location" size={22} color={PRIMARY_COLOR} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[14px] text-[#181A20]">
                                {route.params.locationName || 'Class Location'}
                            </Text>
                            <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                {classCode} • {className}
                            </Text>
                        </View>
                        {isInsideGeofence && (
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E8F5E9]">
                                <Ionicons name="checkmark" size={18} color="#4CAF50" />
                            </View>
                        )}
                    </View>

                    {/* Action Button */}
                    {isInsideGeofence ? (
                        <Pressable
                            onPress={() => navigation.goBack()}
                            className="h-14 items-center justify-center rounded-[14px] bg-[#4CAF50]"
                        >
                            <Text className="font-medium text-[16px] text-white">Done</Text>
                        </Pressable>
                    ) : (
                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => navigation.goBack()}
                                className="flex-1 h-14 items-center justify-center rounded-[14px] bg-[#F1F2F6]"
                            >
                                <Text className="font-medium text-[15px] text-[#5A5D6B]">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={centerOnUser}
                                className="flex-1 h-14 flex-row items-center justify-center rounded-[14px] bg-[#6343cc]"
                            >
                                <MaterialIcons name="my-location" size={20} color="#fff" />
                                <Text className="ml-2 font-medium text-[15px] text-white">Center Me</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    destinationMarker: {
        alignItems: 'center',
    },
    destinationMarkerInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: PRIMARY_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    destinationMarkerTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 12,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: PRIMARY_COLOR,
        marginTop: -2,
    },
    userMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarkerPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
    },
    userMarker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#2196F3',
        borderWidth: 4,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    userMarkerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#fff',
        marginTop: -2,
    },
    recenterButton: {
        position: 'absolute',
        right: 16,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -5 },
        elevation: 10,
    },
});
