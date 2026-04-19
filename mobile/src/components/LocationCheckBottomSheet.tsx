import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
    forwardRef,
    useCallback,
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

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export const LocationCheckBottomSheet = forwardRef<LocationCheckBottomSheetRef, LocationCheckBottomSheetProps>(
    ({ classLocation, classCode, className }, ref) => {
        const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const mapRef = useRef<MapView>(null);
        const insets = useSafeAreaInsets();

        const [isChecking, setIsChecking] = useState(false);
        const [checkResult, setCheckResult] = useState<'checking' | 'inside' | 'outside' | null>(null);
        const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
        const [distance, setDistance] = useState<number | null>(null);

        const isPolygonMode = classLocation.polygonCoords && classLocation.polygonCoords.length >= 3;

        const snapPoints = useMemo(() => ['85%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
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

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                const userLat = location.coords.latitude;
                const userLon = location.coords.longitude;

                setUserLocation({ latitude: userLat, longitude: userLon });

                const dist = getDistanceFromLatLonInMeters(
                    userLat,
                    userLon,
                    classLocation.latitude,
                    classLocation.longitude
                );

                setDistance(dist);

                // Check if inside geofenced area
                let isInside = false;
                if (isPolygonMode && classLocation.polygonCoords) {
                    // Use polygon containment check
                    isInside = isPointInPolygon(
                        { latitude: userLat, longitude: userLon },
                        classLocation.polygonCoords
                    );
                } else if (classLocation.radius) {
                    // Use radius-based check
                    isInside = dist <= classLocation.radius;
                }

                if (isInside) {
                    setCheckResult('inside');
                } else {
                    setCheckResult('outside');
                }

                // Fit map to show both locations
                if (mapRef.current) {
                    mapRef.current.fitToCoordinates(
                        [
                            { latitude: userLat, longitude: userLon },
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
                    <View className="rounded-[20px] overflow-hidden mb-4" style={{ height: 220 }}>
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1 }}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={{
                                latitude: classLocation.latitude,
                                longitude: classLocation.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }}
                            showsUserLocation={false}
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

                            {/* User Location Marker */}
                            {userLocation && (
                                <Marker
                                    coordinate={userLocation}
                                    title="Your Location"
                                >
                                    <View style={styles.userMarker}>
                                        <Ionicons name="person" size={16} color="#fff" />
                                    </View>
                                </Marker>
                            )}
                        </MapView>
                    </View>

                    {/* Status Card */}
                    {checkResult === 'checking' ? (
                        <View className="rounded-[16px] bg-white p-5 mb-4 items-center">
                            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                            <Text className="font-medium text-[15px] text-[#181A20] mt-3">Checking your location...</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">Please wait</Text>
                        </View>
                    ) : checkResult === 'inside' ? (
                        <View className="rounded-[16px] bg-[#E8F5E9] p-5 mb-4">
                            <View className="flex-row items-center">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#4CAF50]">
                                    <Ionicons name="checkmark-circle" size={32} color="#fff" />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[18px] text-[#2E7D32]">You're Here!</Text>
                                    <Text className="text-[13px] text-[#4CAF50] mt-1">
                                        You are within the class location ({formatDistance(distance || 0)} away)
                                    </Text>
                                </View>
                            </View>
                        </View>
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
                                </View>
                            </View>
                        </View>
                    ) : null}

                    {/* Distance Info */}
                    {distance !== null && checkResult !== 'checking' && (
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

                    {/* Action Buttons */}
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

                    {/* Directions Button for all users (even when inside) */}
                    {checkResult === 'inside' && (
                        <Pressable
                            onPress={openDirections}
                            className="mt-3 h-14 flex-row items-center justify-center rounded-[14px] bg-[#6343cc]"
                        >
                            <MaterialIcons name="directions" size={22} color="#fff" />
                            <Text className="ml-2 font-medium text-[15px] text-white">View on Map</Text>
                        </Pressable>
                    )}
                </BottomSheetView>
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
    userMarker: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#2196F3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
});
