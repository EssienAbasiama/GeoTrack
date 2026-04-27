import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    forwardRef,
    type ForwardedRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Pressable,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Dimensions,
    Animated,
    Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { ensureLocationPermission } from '../utils/permissions';
import { LivenessCheckBottomSheet, LivenessCheckBottomSheetRef } from './LivenessCheckBottomSheet';
import { useRole } from '../store/RoleContext';
import { successFeedback, errorFeedback, warningFeedback, mediumImpact, lightImpact, softPulse } from '../utils/haptics';

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom map styling for a more realistic, modern look
const customMapStyle = [
    {
        "featureType": "poi",
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "simplified" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#ffffff" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#e0e0e0" }]
    },
    {
        "featureType": "road.arterial",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#f5f5f5" }]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#ffeaa8" }]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#f5c842" }]
    },
    {
        "featureType": "landscape.natural",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#e8f5e9" }]
    },
    {
        "featureType": "water",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#b3e5fc" }]
    },
    {
        "featureType": "transit",
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
    }
];

interface PolygonCoordinate {
    latitude: number;
    longitude: number;
}

interface GeoLocation {
    latitude: number;
    longitude: number;
    radius?: number;
    name: string;
    polygonCoords?: PolygonCoordinate[];
}

// Point-in-polygon algorithm (ray casting)
function isPointInPolygon(
    point: PolygonCoordinate,
    polygon: PolygonCoordinate[]
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

export interface LocationCheckBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface LocationCheckBottomSheetProps {
    classLocation: GeoLocation;
    classCode: string;
    className: string;
    isClassActive?: boolean;
    isAttendanceEnabled?: boolean;
    studentName?: string;
    onCheckInSuccess?: () => void;
}

// Haversine formula to calculate distance between two points
function getDistanceFromLatLonInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000; // Radius of the earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

export const LocationCheckBottomSheet = forwardRef(
    (
        { classLocation, classCode, className, isClassActive = true, isAttendanceEnabled = true, studentName, onCheckInSuccess }: LocationCheckBottomSheetProps,
        ref: ForwardedRef<LocationCheckBottomSheetRef>
    ) => {
        const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
        const { isStudent } = useRole();
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const livenessCheckRef = useRef<LivenessCheckBottomSheetRef>(null);
        const mapRef = useRef<MapView>(null);
        const insets = useSafeAreaInsets();

        const [isChecking, setIsChecking] = useState(false);
        const [checkResult, setCheckResult] = useState<'checking' | 'inside' | 'outside' | 'poor_accuracy' | null>(null);
        const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
        const [distance, setDistance] = useState<number | null>(null);
        const [heading, setHeading] = useState<number>(0);
        const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
        const [verificationProgress, setVerificationProgress] = useState(0);

        // Minimum accuracy required (in meters) - reject readings worse than this
        const REQUIRED_ACCURACY = 15;
        // Number of samples to take for verification
        const VERIFICATION_SAMPLES = 3;
        // Delay between samples (ms)
        const SAMPLE_DELAY = 800;

        // Animations
        const successPulse = useRef(new Animated.Value(1)).current;
        const buttonScale = useRef(new Animated.Value(1)).current;
        const userPulse = useRef(new Animated.Value(1)).current;

        // User marker pulse animation
        useEffect(() => {
            if (userLocation) {
                const pulse = Animated.loop(
                    Animated.sequence([
                        Animated.timing(userPulse, {
                            toValue: 1.4,
                            duration: 1200,
                            easing: Easing.out(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(userPulse, {
                            toValue: 1,
                            duration: 1200,
                            easing: Easing.in(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulse.start();
                return () => pulse.stop();
            }
        }, [userLocation !== null]);

        const isPolygonMode = classLocation.polygonCoords && classLocation.polygonCoords.length >= 3;

        const snapPoints = useMemo(() => ['85%'], []);
        const canProceedToCheckIn = isStudent && isClassActive && isAttendanceEnabled;

        // Success pulse animation
        useEffect(() => {
            if (checkResult === 'inside') {
                const pulse = Animated.loop(
                    Animated.sequence([
                        Animated.timing(successPulse, {
                            toValue: 1.05,
                            duration: 800,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(successPulse, {
                            toValue: 1,
                            duration: 800,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulse.start();
                return () => pulse.stop();
            }
        }, [checkResult]);

        const handleProceedToLiveness = () => {
            mediumImpact(); // Haptic feedback on button press
            // Animate button press
            Animated.sequence([
                Animated.timing(buttonScale, {
                    toValue: 0.95,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(buttonScale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                bottomSheetRef.current?.dismiss();
                setTimeout(() => {
                    livenessCheckRef.current?.open();
                }, 300);
            });
        };

        const handleLivenessSuccess = () => {
            onCheckInSuccess?.();
        };

        useImperativeHandle(ref, () => ({
            open: () => {
                lightImpact(); // Haptic when sheet opens
                setCheckResult(null);
                setUserLocation(null);
                setDistance(null);
                bottomSheetRef.current?.present();
                // Auto-check location when opened
                setTimeout(() => checkLocation(), 500);
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const checkLocation = async () => {
            setIsChecking(true);
            setCheckResult('checking');
            setVerificationProgress(0);

            try {
                // Use permission utility with proper denial handling
                const hasPermission = await ensureLocationPermission(() => {
                    setIsChecking(false);
                    setCheckResult(null);
                });

                if (!hasPermission) {
                    setIsChecking(false);
                    setCheckResult(null);
                    return;
                }

                // Take multiple samples for verification
                const samples: { lat: number; lon: number; accuracy: number; isInside: boolean }[] = [];

                for (let i = 0; i < VERIFICATION_SAMPLES; i++) {
                    setVerificationProgress(((i + 1) / VERIFICATION_SAMPLES) * 100);
                    softPulse(); // Subtle haptic for each sample

                    // Get high-accuracy location reading
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.BestForNavigation,
                    });

                    const accuracy = location.coords.accuracy || 999;
                    const userLat = location.coords.latitude;
                    const userLon = location.coords.longitude;

                    // Update UI with latest reading
                    setUserLocation({ latitude: userLat, longitude: userLon });
                    setLocationAccuracy(accuracy);

                    if (location.coords.heading !== null && location.coords.heading !== undefined) {
                        setHeading(location.coords.heading);
                    }

                    // Check if this sample is inside the boundary
                    let isInside = false;
                    if (isPolygonMode && classLocation.polygonCoords) {
                        isInside = isPointInPolygon(
                            { latitude: userLat, longitude: userLon },
                            classLocation.polygonCoords
                        );
                    } else if (classLocation.radius) {
                        const dist = getDistanceFromLatLonInMeters(
                            userLat, userLon,
                            classLocation.latitude, classLocation.longitude
                        );
                        isInside = dist <= classLocation.radius;
                    }

                    samples.push({ lat: userLat, lon: userLon, accuracy, isInside });

                    // Wait before next sample (except for last one)
                    if (i < VERIFICATION_SAMPLES - 1) {
                        await new Promise(resolve => setTimeout(resolve, SAMPLE_DELAY));
                    }
                }

                // Calculate final position (average of samples)
                const avgLat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length;
                const avgLon = samples.reduce((sum, s) => sum + s.lon, 0) / samples.length;
                const bestAccuracy = Math.min(...samples.map(s => s.accuracy));
                const allInside = samples.every(s => s.isInside);
                const anyPoorAccuracy = samples.some(s => s.accuracy > REQUIRED_ACCURACY);

                setUserLocation({ latitude: avgLat, longitude: avgLon });
                setLocationAccuracy(bestAccuracy);

                const dist = getDistanceFromLatLonInMeters(
                    avgLat, avgLon,
                    classLocation.latitude, classLocation.longitude
                );
                setDistance(dist);

                // Strict verification: 
                // 1. GPS accuracy must be acceptable
                // 2. ALL samples must be inside the boundary
                if (anyPoorAccuracy) {
                    setCheckResult('poor_accuracy');
                    warningFeedback(); // Haptic warning for poor GPS
                } else if (allInside) {
                    setCheckResult('inside');
                    successFeedback(); // Haptic success for inside boundary
                } else {
                    setCheckResult('outside');
                    errorFeedback(); // Haptic error for outside boundary
                }

                // Fit map to show both locations
                if (mapRef.current) {
                    mapRef.current.fitToCoordinates(
                        [
                            { latitude: avgLat, longitude: avgLon },
                            { latitude: classLocation.latitude, longitude: classLocation.longitude },
                        ],
                        {
                            edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                            animated: true,
                        }
                    );
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to get your location. Please try again.');
                setCheckResult(null);
            } finally {
                setIsChecking(false);
                setVerificationProgress(0);
            }
        };
        const openDirections = () => {
            // Navigate to in-app navigation screen
            bottomSheetRef.current?.dismiss();
            navigation.navigate('Navigation', {
                destination: {
                    latitude: classLocation.latitude,
                    longitude: classLocation.longitude,
                },
                classCode,
                className,
                locationName: classLocation.name,
                polygonCoords: classLocation.polygonCoords,
            });
        };

        const formatDistance = (meters: number): string => {
            if (meters < 1000) {
                return `${Math.round(meters)}m`;
            }
            return `${(meters / 1000).toFixed(1)}km`;
        };

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose
                handleIndicatorStyle={styles.handleIndicator}
                backgroundStyle={styles.background}
            >
                <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1">
                            <Text className="font-heading text-[20px] text-[#181A20]">Location Check</Text>
                            <View className="flex-row items-center mt-1">
                                <Ionicons name="location" size={12} color="#8F94A4" />
                                <Text className="text-[13px] text-[#8F94A4] ml-1">{classLocation.name}</Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    {/* Map View */}
                    <View className="rounded-[20px] overflow-hidden mb-4" style={{ height: 240 }}>
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1 }}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={{
                                latitude: classLocation.latitude,
                                longitude: classLocation.longitude,
                                latitudeDelta: 0.003,
                                longitudeDelta: 0.003,
                            }}
                            customMapStyle={customMapStyle}
                            mapType="standard"
                            showsBuildings={true}
                            showsTraffic={false}
                            showsIndoors={true}
                            showsUserLocation={false}
                            showsCompass={false}
                            showsScale={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                        >
                            {/* Class Location Marker */}
                            <Marker
                                coordinate={{
                                    latitude: classLocation.latitude,
                                    longitude: classLocation.longitude,
                                }}
                                title={classLocation.name}
                                description={`${classCode} Class Location`}
                            >
                                <View style={styles.classMarker}>
                                    <Ionicons name="school" size={20} color="#fff" />
                                </View>
                            </Marker>

                            {/* Geofence - Circle or Polygon */}
                            {isPolygonMode && classLocation.polygonCoords ? (
                                <Polygon
                                    coordinates={classLocation.polygonCoords}
                                    fillColor="rgba(99, 67, 204, 0.15)"
                                    strokeColor={PRIMARY_COLOR}
                                    strokeWidth={2}
                                />
                            ) : classLocation.radius ? (
                                <Circle
                                    center={{
                                        latitude: classLocation.latitude,
                                        longitude: classLocation.longitude,
                                    }}
                                    radius={classLocation.radius}
                                    fillColor="rgba(99, 67, 204, 0.15)"
                                    strokeColor={PRIMARY_COLOR}
                                    strokeWidth={2}
                                />
                            ) : null}

                            {/* User Location Marker with Direction Arrow */}
                            {userLocation && (
                                <Marker
                                    coordinate={userLocation}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    flat={true}
                                    rotation={heading}
                                >
                                    <View style={styles.userMarkerContainer}>
                                        {/* Accuracy circle / pulse */}
                                        <Animated.View
                                            style={[
                                                styles.userMarkerPulse,
                                                {
                                                    transform: [{ scale: userPulse }],
                                                    opacity: userPulse.interpolate({
                                                        inputRange: [1, 1.4],
                                                        outputRange: [0.4, 0],
                                                    }),
                                                },
                                            ]}
                                        />
                                        {/* Main marker with integrated arrow */}
                                        <View style={styles.userMarkerWrapper}>
                                            {/* Direction arrow - attached to top of marker */}
                                            <View style={styles.userDirectionArrow} />
                                            {/* Main dot */}
                                            <View style={styles.userMarker}>
                                                <View style={styles.userMarkerInner} />
                                            </View>
                                        </View>
                                    </View>
                                </Marker>
                            )}
                        </MapView>

                        {/* Accuracy Badge */}
                        {locationAccuracy !== null && (
                            <View style={styles.accuracyBadge}>
                                <MaterialIcons name="gps-fixed" size={12} color={locationAccuracy <= 10 ? '#4CAF50' : locationAccuracy <= 30 ? '#FF9800' : '#EF5350'} />
                                <Text style={[styles.accuracyText, { color: locationAccuracy <= 10 ? '#4CAF50' : locationAccuracy <= 30 ? '#FF9800' : '#EF5350' }]}>
                                    ±{Math.round(locationAccuracy)}m
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Status Card */}
                    {checkResult === 'checking' ? (
                        <View className="rounded-[16px] bg-white p-5 mb-4 items-center">
                            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                            <Text className="font-medium text-[15px] text-[#181A20] mt-3">Verifying location...</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">
                                Taking {VERIFICATION_SAMPLES} readings for accuracy
                            </Text>
                            {verificationProgress > 0 && (
                                <View className="w-full mt-3">
                                    <View className="h-2 bg-[#F1F2F6] rounded-full overflow-hidden">
                                        <View
                                            className="h-full bg-[#6343cc] rounded-full"
                                            style={{ width: `${verificationProgress}%` }}
                                        />
                                    </View>
                                    <Text className="text-[11px] text-[#8F94A4] mt-1 text-center">
                                        {Math.round(verificationProgress)}% complete
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : checkResult === 'poor_accuracy' ? (
                        <View className="rounded-[16px] bg-[#FFF3E0] p-5 mb-4">
                            <View className="flex-row items-center">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FF9800]">
                                    <MaterialIcons name="gps-off" size={28} color="#fff" />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[18px] text-[#E65100]">Poor GPS Signal</Text>
                                    <Text className="text-[13px] text-[#FF9800] mt-1">
                                        GPS accuracy is ±{Math.round(locationAccuracy || 0)}m (need ≤{REQUIRED_ACCURACY}m)
                                    </Text>
                                    <Text className="text-[12px] text-[#E65100] mt-1">
                                        Move to an open area and try again
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : checkResult === 'inside' ? (
                        <Animated.View
                            className="rounded-[16px] bg-[#E8F5E9] p-5 mb-4"
                            style={{ transform: [{ scale: successPulse }] }}
                        >
                            <View className="flex-row items-center">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#4CAF50]">
                                    <Ionicons name="checkmark-circle" size={32} color="#fff" />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[18px] text-[#2E7D32]">You're Here!</Text>
                                    <Text className="text-[13px] text-[#4CAF50] mt-1">
                                        You are within the class location ({formatDistance(distance || 0)} away)
                                    </Text>
                                    {canProceedToCheckIn && (
                                        <Text className="text-[12px] text-[#2E7D32] mt-1 font-medium">
                                            Ready for check-in verification
                                        </Text>
                                    )}
                                    {isStudent && isClassActive && !isAttendanceEnabled && (
                                        <Text className="text-[12px] text-[#2E7D32] mt-1 font-medium">
                                            Attendance is currently closed by your lecturer
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </Animated.View>
                    ) : checkResult === 'outside' ? (
                        <View className="rounded-[16px] bg-[#FFEBEE] p-5 mb-4">
                            <View className="flex-row items-center">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EF5350]">
                                    <Ionicons name="close-circle" size={32} color="#fff" />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[18px] text-[#C62828]">Not in Class Area</Text>
                                    <Text className="text-[13px] text-[#EF5350] mt-1">
                                        You are {formatDistance(distance || 0)} away from the class location
                                    </Text>
                                    {canProceedToCheckIn && (
                                        <Text className="text-[12px] text-[#C62828] mt-1">
                                            Go to the class location to check in
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    ) : null}

                    {/* Distance Info */}
                    {distance !== null && checkResult !== 'checking' && checkResult !== 'poor_accuracy' && (
                        <View className="flex-row gap-3 mb-4">
                            <View className="flex-1 rounded-[14px] bg-white p-4">
                                <View className="flex-row items-center">
                                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD]">
                                        <MaterialIcons name="straighten" size={20} color="#2196F3" />
                                    </View>
                                    <View className="ml-3">
                                        <Text className="text-[10px] text-[#8F94A4]">Distance</Text>
                                        <Text className="font-heading text-[18px] text-[#181A20]">
                                            {formatDistance(distance)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View className="flex-1 rounded-[14px] bg-white p-4">
                                <View className="flex-row items-center">
                                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#F0EDFC]">
                                        <Ionicons name={isPolygonMode ? "shapes" : "radio-button-on"} size={20} color={PRIMARY_COLOR} />
                                    </View>
                                    <View className="ml-3">
                                        <Text className="text-[10px] text-[#8F94A4]">Geofence</Text>
                                        <Text className="font-heading text-[18px] text-[#181A20]">
                                            {isPolygonMode ? 'Custom' : `${classLocation.radius}m`}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* GPS Tips for Poor Accuracy */}
                    {checkResult === 'poor_accuracy' && (
                        <View className="rounded-[14px] bg-[#FFF8E1] p-4 mb-4">
                            <Text className="font-medium text-[13px] text-[#F57C00] mb-2">Tips for better GPS:</Text>
                            <View className="flex-row items-start mb-1">
                                <MaterialIcons name="check" size={14} color="#FF9800" />
                                <Text className="text-[12px] text-[#795548] ml-2 flex-1">Move away from buildings and trees</Text>
                            </View>
                            <View className="flex-row items-start mb-1">
                                <MaterialIcons name="check" size={14} color="#FF9800" />
                                <Text className="text-[12px] text-[#795548] ml-2 flex-1">Ensure clear sky view</Text>
                            </View>
                            <View className="flex-row items-start">
                                <MaterialIcons name="check" size={14} color="#FF9800" />
                                <Text className="text-[12px] text-[#795548] ml-2 flex-1">Wait a few seconds for GPS to lock</Text>
                            </View>
                        </View>
                    )}

                    {/* Action Buttons */}
                    {checkResult === 'poor_accuracy' ? (
                        <Pressable
                            onPress={checkLocation}
                            disabled={isChecking}
                            className="h-14 flex-row items-center justify-center rounded-[14px] bg-[#FF9800]"
                        >
                            <Ionicons name="refresh" size={22} color="#fff" />
                            <Text className="ml-2 font-medium text-[16px] text-white">Try Again</Text>
                        </Pressable>
                    ) : (
                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={checkLocation}
                                disabled={isChecking}
                                className="flex-1 h-14 flex-row items-center justify-center rounded-[14px] bg-white border border-[#E8EAF1]"
                            >
                                <Ionicons name="refresh" size={20} color="#5A5D6B" />
                                <Text className="ml-2 font-medium text-[15px] text-[#5A5D6B]">Recheck</Text>
                            </Pressable>
                            {checkResult === 'outside' && (
                                <Pressable
                                    onPress={openDirections}
                                    className="flex-1 h-14 flex-row items-center justify-center rounded-[14px] bg-[#6343cc]"
                                >
                                    <MaterialIcons name="directions" size={22} color="#fff" />
                                    <Text className="ml-2 font-medium text-[15px] text-white">Get Directions</Text>
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* Student Check-In Button - shows when inside and class is active */}
                    {checkResult === 'inside' && canProceedToCheckIn && (
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                            <Pressable
                                onPress={handleProceedToLiveness}
                                className="mt-3 h-14 flex-row items-center justify-center rounded-[14px] bg-[#4CAF50]"
                                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                            >
                                <Animated.View
                                    style={{ transform: [{ scale: successPulse }] }}
                                    className="flex-row items-center"
                                >
                                    <MaterialCommunityIcons name="face-recognition" size={24} color="#fff" />
                                    <Text className="ml-2 font-medium text-[16px] text-white">Proceed to Check-In</Text>
                                </Animated.View>
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* View on Map for non-students or when viewing directions */}
                    {checkResult === 'inside' && !isStudent && (
                        <Pressable
                            onPress={openDirections}
                            className="mt-3 h-14 flex-row items-center justify-center rounded-[14px] bg-[#6343cc]"
                        >
                            <MaterialIcons name="directions" size={22} color="#fff" />
                            <Text className="ml-2 font-medium text-[15px] text-white">View on Map</Text>
                        </Pressable>
                    )}

                    {/* View Map option for students who are inside */}
                    {checkResult === 'inside' && isStudent && (
                        <Pressable
                            onPress={openDirections}
                            className="mt-2 h-12 flex-row items-center justify-center"
                        >
                            <MaterialIcons name="map" size={18} color="#8F94A4" />
                            <Text className="ml-2 font-medium text-[14px] text-[#8F94A4]">View on Map</Text>
                        </Pressable>
                    )}
                </BottomSheetView>

                {/* Liveness Check Bottom Sheet */}
                <LivenessCheckBottomSheet
                    ref={livenessCheckRef}
                    onSuccess={handleLivenessSuccess}
                    onCancel={() => bottomSheetRef.current?.present()}
                    studentName={studentName}
                    classCode={classCode}
                />
            </BottomSheetModal>
        );
    }
);

LocationCheckBottomSheet.displayName = 'LocationCheckBottomSheet';

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#F6F6F9',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    handleIndicator: {
        width: 88,
        height: 4,
        borderRadius: 3,
        backgroundColor: '#BCBDC0',
        alignSelf: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    classMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: PRIMARY_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    userMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 60,
    },
    userMarkerPulse: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(33, 150, 243, 0.3)',
    },
    userMarkerWrapper: {
        alignItems: 'center',
    },
    userDirectionArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#2196F3',
        marginBottom: -2,
    },
    userMarker: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#2196F3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    userMarkerInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    accuracyBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    accuracyText: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
});
