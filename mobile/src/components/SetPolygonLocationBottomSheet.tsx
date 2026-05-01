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
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PolygonCoordinate {
    latitude: number;
    longitude: number;
}

export interface GeoPolygon {
    coordinates: PolygonCoordinate[];
    name: string;
    center: PolygonCoordinate; // For initial map centering
}

export interface SetPolygonLocationBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface SetPolygonLocationBottomSheetProps {
    classCode: string;
    onSaveLocation: (location: GeoPolygon) => void;
    existingLocation?: GeoPolygon | null;
}

export const SetPolygonLocationBottomSheet = forwardRef<SetPolygonLocationBottomSheetRef, SetPolygonLocationBottomSheetProps>(
    ({ classCode, onSaveLocation, existingLocation }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const mapRef = useRef<MapView>(null);
        const insets = useSafeAreaInsets();

        const [locationName, setLocationName] = useState('');
        const [polygonCoords, setPolygonCoords] = useState<PolygonCoordinate[]>([]);
        const [isLoading, setIsLoading] = useState(false);
        const [isFetchingLocation, setIsFetchingLocation] = useState(false);
        // Default to FUNAAB (Federal University of Agriculture, Abeokuta)
        const [mapRegion, setMapRegion] = useState({
            latitude: 7.2266,
            longitude: 3.4400,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
        });
        const [isDrawingMode, setIsDrawingMode] = useState(false);

        const snapPoints = useMemo(() => ['92%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
                setLocationName(existingLocation?.name || '');
                setPolygonCoords(existingLocation?.coordinates || []);
                if (existingLocation?.center) {
                    setMapRegion({
                        ...mapRegion,
                        latitude: existingLocation.center.latitude,
                        longitude: existingLocation.center.longitude,
                    });
                }
                bottomSheetRef.current?.present();
                // Auto-fetch current location to center map
                fetchCurrentLocation();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const fetchCurrentLocation = async () => {
            setIsFetchingLocation(true);
            try {
                // Use permission utility with proper denial handling
                const hasPermission = await ensureLocationPermission(() => {
                    setIsFetchingLocation(false);
                });

                if (!hasPermission) {
                    setIsFetchingLocation(false);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                const newRegion = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.002,
                    longitudeDelta: 0.002,
                };
                setMapRegion(newRegion);
                mapRef.current?.animateToRegion(newRegion, 500);
            } catch (error) {
                console.log('Error fetching location:', error);
            } finally {
                setIsFetchingLocation(false);
            }
        };

        const handleMapPress = (event: MapPressEvent) => {
            if (!isDrawingMode) return;

            const { coordinate } = event.nativeEvent;
            setPolygonCoords((prev) => [...prev, coordinate]);
        };

        const handleRemoveLastPoint = () => {
            setPolygonCoords((prev) => prev.slice(0, -1));
        };

        const handleClearAllPoints = () => {
            Alert.alert(
                'Clear All Points',
                'Are you sure you want to clear all boundary points?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: () => setPolygonCoords([]) },
                ]
            );
        };

        const calculateCenter = (coords: PolygonCoordinate[]): PolygonCoordinate => {
            if (coords.length === 0) return { latitude: 0, longitude: 0 };
            const sum = coords.reduce(
                (acc, coord) => ({
                    latitude: acc.latitude + coord.latitude,
                    longitude: acc.longitude + coord.longitude,
                }),
                { latitude: 0, longitude: 0 }
            );
            return {
                latitude: sum.latitude / coords.length,
                longitude: sum.longitude / coords.length,
            };
        };

        const handleSave = () => {
            if (!locationName.trim()) {
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: "bottom" });
                return;
            }
            if (polygonCoords.length < 3) {
                Toast.show({ type: 'error', text1: 'Please draw at least 3 points to create a boundary', position: "bottom" });
                return;
            }

            setIsLoading(true);
            setTimeout(() => {
                onSaveLocation({
                    coordinates: polygonCoords,
                    name: locationName.trim(),
                    center: calculateCenter(polygonCoords),
                });
                setIsLoading(false);
                bottomSheetRef.current?.dismiss();
            }, 500);
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
                keyboardBehavior="extend"
                android_keyboardInputMode="adjustResize"
                handleIndicatorStyle={styles.handleIndicator}
                backgroundStyle={styles.background}
            >
                <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Set Class Boundary</Text>
                            <Text className="text-[12px] text-[#8F94A4] mt-0.5">{classCode}</Text>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    {/* Map View */}
                    <View className="rounded-[20px] overflow-hidden mb-3" style={{ height: 280 }}>
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1 }}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={mapRegion}
                            onPress={handleMapPress}
                            showsUserLocation
                            showsMyLocationButton={false}
                        >
                            {/* Polygon markers */}
                            {polygonCoords.map((coord, index) => (
                                <Marker
                                    key={`marker-${index}`}
                                    coordinate={coord}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                >
                                    <View style={[styles.markerPoint, index === 0 && styles.firstMarker]}>
                                        <Text style={styles.markerText}>{index + 1}</Text>
                                    </View>
                                </Marker>
                            ))}

                            {/* Polygon shape */}
                            {polygonCoords.length >= 3 && (
                                <Polygon
                                    coordinates={polygonCoords}
                                    fillColor="rgba(99, 67, 204, 0.2)"
                                    strokeColor={PRIMARY_COLOR}
                                    strokeWidth={3}
                                />
                            )}
                        </MapView>

                        {/* Drawing Mode Toggle */}
                        <View style={styles.mapOverlay}>
                            <Pressable
                                onPress={() => setIsDrawingMode(!isDrawingMode)}
                                style={[
                                    styles.drawButton,
                                    isDrawingMode && styles.drawButtonActive,
                                ]}
                            >
                                <MaterialIcons
                                    name="edit-location-alt"
                                    size={22}
                                    color={isDrawingMode ? '#fff' : PRIMARY_COLOR}
                                />
                                <Text
                                    style={[
                                        styles.drawButtonText,
                                        isDrawingMode && styles.drawButtonTextActive,
                                    ]}
                                >
                                    {isDrawingMode ? 'Tap to Add Points' : 'Draw Boundary'}
                                </Text>
                            </Pressable>

                            {/* My Location Button */}
                            <Pressable
                                onPress={fetchCurrentLocation}
                                style={styles.myLocationButton}
                                disabled={isFetchingLocation}
                            >
                                {isFetchingLocation ? (
                                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                ) : (
                                    <MaterialIcons name="my-location" size={22} color={PRIMARY_COLOR} />
                                )}
                            </Pressable>
                        </View>

                        {/* Drawing Instructions */}
                        {isDrawingMode && (
                            <View style={styles.instructionBanner}>
                                <Ionicons name="finger-print" size={16} color="#fff" />
                                <Text style={styles.instructionText}>
                                    Tap on the map to add boundary points
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Point Controls */}
                    <View className="flex-row gap-2 mb-3">
                        <Pressable
                            onPress={handleRemoveLastPoint}
                            disabled={polygonCoords.length === 0}
                            className={`flex-1 h-10 flex-row items-center justify-center rounded-[10px] ${polygonCoords.length > 0 ? 'bg-[#FFF3E0]' : 'bg-[#F1F2F6]'
                                }`}
                        >
                            <Ionicons
                                name="arrow-undo"
                                size={16}
                                color={polygonCoords.length > 0 ? '#FF9800' : '#B8BBC6'}
                            />
                            <Text
                                className={`ml-1.5 font-medium text-[12px] ${polygonCoords.length > 0 ? 'text-[#FF9800]' : 'text-[#B8BBC6]'
                                    }`}
                            >
                                Undo
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleClearAllPoints}
                            disabled={polygonCoords.length === 0}
                            className={`flex-1 h-10 flex-row items-center justify-center rounded-[10px] ${polygonCoords.length > 0 ? 'bg-[#FFEBEE]' : 'bg-[#F1F2F6]'
                                }`}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={16}
                                color={polygonCoords.length > 0 ? '#EF5350' : '#B8BBC6'}
                            />
                            <Text
                                className={`ml-1.5 font-medium text-[12px] ${polygonCoords.length > 0 ? 'text-[#EF5350]' : 'text-[#B8BBC6]'
                                    }`}
                            >
                                Clear All
                            </Text>
                        </Pressable>
                        <View className="flex-1 h-10 flex-row items-center justify-center rounded-[10px] bg-[#F0EDFC]">
                            <Ionicons name="location" size={16} color={PRIMARY_COLOR} />
                            <Text className="ml-1.5 font-medium text-[12px] text-[#6343cc]">
                                {polygonCoords.length} points
                            </Text>
                        </View>
                    </View>

                    {/* Location Name Input */}
                    <View className="mb-4">
                        <Text className="text-[12px] font-medium text-[#5A5D6B] mb-1.5">Location Name</Text>
                        <View className="flex-row items-center h-[48px] rounded-[12px] bg-white border border-[#E8EAF1] px-3">
                            <Ionicons name="pricetag-outline" size={16} color="#8F94A4" />
                            <BottomSheetTextInput
                                value={locationName}
                                onChangeText={setLocationName}
                                placeholder="e.g., LT 201, Faculty Building A"
                                placeholderTextColor="#B8BBC6"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Info Card */}
                    <View className="rounded-[12px] bg-[#E3F2FD] p-3 mb-4">
                        <View className="flex-row items-start">
                            <Ionicons name="information-circle" size={18} color="#2196F3" />
                            <Text className="ml-2 flex-1 text-[11px] text-[#1976D2] leading-4">
                                Draw at least 3 points to create a boundary. The shape can be any polygon - rectangle, square, or irregular shape that matches the class area.
                            </Text>
                        </View>
                    </View>

                    {/* Save Button */}
                    <Pressable
                        onPress={handleSave}
                        disabled={isLoading || polygonCoords.length < 3 || !locationName.trim()}
                        className={`h-13 items-center justify-center rounded-[14px] ${polygonCoords.length >= 3 && locationName.trim()
                            ? 'bg-[#6343cc]'
                            : 'bg-[#E8EAF1]'
                            }`}
                        style={{ height: 52 }}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text
                                className={`font-medium text-[15px] ${polygonCoords.length >= 3 && locationName.trim()
                                    ? 'text-white'
                                    : 'text-[#B8BBC6]'
                                    }`}
                            >
                                Save Boundary
                            </Text>
                        )}
                    </Pressable>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

SetPolygonLocationBottomSheet.displayName = 'SetPolygonLocationBottomSheet';

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
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: '#181A20',
    },
    markerPoint: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: PRIMARY_COLOR,
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
    firstMarker: {
        backgroundColor: '#4CAF50',
    },
    markerText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    mapOverlay: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    drawButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    drawButtonActive: {
        backgroundColor: PRIMARY_COLOR,
    },
    drawButtonText: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: '600',
        color: PRIMARY_COLOR,
    },
    drawButtonTextActive: {
        color: '#fff',
    },
    myLocationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    instructionBanner: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: PRIMARY_COLOR,
    },
    instructionText: {
        marginLeft: 8,
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
});
