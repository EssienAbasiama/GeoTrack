import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Pressable,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
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
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

const PRIMARY = '#6343cc';
const SUCCESS = '#22C55E';

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
        const pulseAnim = useRef(new Animated.Value(1)).current;

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

        const snapPoints = useMemo(() => ['96%'], []);
        const isComplete = polygonCoords.length >= 3;
        const canSave = isComplete && locationName.trim().length > 0;

        // Pulse animation while drawing mode is active
        useEffect(() => {
            if (isDrawingMode) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.12, duration: 650, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
                    ])
                ).start();
            } else {
                pulseAnim.stopAnimation();
                pulseAnim.setValue(1);
            }
        }, [isDrawingMode]);

        useImperativeHandle(ref, () => ({
            open: () => {
                setLocationName(existingLocation?.name || '');
                setPolygonCoords(existingLocation?.coordinates || []);
                setIsDrawingMode(false);
                if (existingLocation?.center) {
                    setMapRegion({
                        ...mapRegion,
                        latitude: existingLocation.center.latitude,
                        longitude: existingLocation.center.longitude,
                    });
                }
                bottomSheetRef.current?.present();
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

        const handleUndo = () => setPolygonCoords((prev) => prev.slice(0, -1));

        const handleClear = () => {
            setPolygonCoords([]);
            setIsDrawingMode(false);
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
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: 'bottom' });
                return;
            }
            if (polygonCoords.length < 3) {
                Toast.show({ type: 'error', text1: 'Draw at least 3 points to create a boundary', position: 'bottom' });
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
            }, 400);
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
                <BottomSheetView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>

                    {/* ── Full-height map ── */}
                    <View style={styles.mapWrapper}>
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            provider={PROVIDER_GOOGLE}
                            initialRegion={mapRegion}
                            onPress={handleMapPress}
                            showsUserLocation
                            showsMyLocationButton={false}
                            mapType="satellite"
                        >
                            {/* Numbered point markers */}
                            {polygonCoords.map((coord, index) => (
                                <Marker
                                    key={`pt-${index}`}
                                    coordinate={coord}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    tracksViewChanges={false}
                                >
                                    <View style={[styles.dot, index === 0 && styles.dotFirst]}>
                                        <Text style={styles.dotLabel}>{index + 1}</Text>
                                    </View>
                                </Marker>
                            ))}

                            {/* Guide polyline connecting points */}
                            {polygonCoords.length >= 2 && (
                                <Polyline
                                    coordinates={polygonCoords}
                                    strokeColor="rgba(99,67,204,0.9)"
                                    strokeWidth={2}
                                    lineDashPattern={[8, 4]}
                                />
                            )}

                            {/* Filled polygon once ≥3 points */}
                            {polygonCoords.length >= 3 && (
                                <Polygon
                                    coordinates={polygonCoords}
                                    fillColor="rgba(99,67,204,0.18)"
                                    strokeColor="rgba(99,67,204,0.9)"
                                    strokeWidth={2.5}
                                />
                            )}
                        </MapView>

                        {/* ── Floating header ── */}
                        <View style={styles.floatingHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.headerTitle}>Mark Boundary</Text>
                                <Text style={styles.headerSub}>{classCode}</Text>
                            </View>
                            <Pressable
                                onPress={() => bottomSheetRef.current?.dismiss()}
                                style={styles.closeBtn}
                            >
                                <Ionicons name="close" size={18} color="#fff" />
                            </Pressable>
                        </View>

                        {/* ── Live status pill ── */}
                        <View style={styles.statusPill}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: isComplete ? SUCCESS : isDrawingMode ? '#FFA726' : '#90A4AE' },
                            ]} />
                            <Text style={styles.statusText}>
                                {isComplete
                                    ? `${polygonCoords.length} points · Boundary ready ✓`
                                    : isDrawingMode
                                        ? `${polygonCoords.length} point${polygonCoords.length !== 1 ? 's' : ''} · Need ${Math.max(0, 3 - polygonCoords.length)} more`
                                        : 'Press Draw to start marking'}
                            </Text>
                        </View>

                        {/* ── Floating controls (bottom of map) ── */}
                        <View style={styles.floatingControls}>
                            {/* Animated draw toggle */}
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <Pressable
                                    onPress={() => setIsDrawingMode(v => !v)}
                                    style={[styles.drawToggle, isDrawingMode && styles.drawToggleActive]}
                                >
                                    <MaterialIcons
                                        name={isDrawingMode ? 'edit' : 'edit-location-alt'}
                                        size={20}
                                        color={isDrawingMode ? '#fff' : PRIMARY}
                                    />
                                    <Text style={[styles.drawToggleText, isDrawingMode && { color: '#fff' }]}>
                                        {isDrawingMode ? 'Drawing…' : 'Draw'}
                                    </Text>
                                </Pressable>
                            </Animated.View>

                            {/* Icon group */}
                            <View style={styles.iconGroup}>
                                <Pressable
                                    onPress={handleUndo}
                                    disabled={polygonCoords.length === 0}
                                    style={[styles.iconBtn, polygonCoords.length === 0 && styles.iconBtnDisabled]}
                                >
                                    <Ionicons name="arrow-undo" size={18} color={polygonCoords.length > 0 ? '#FF9800' : '#B0BEC5'} />
                                </Pressable>
                                <Pressable
                                    onPress={handleClear}
                                    disabled={polygonCoords.length === 0}
                                    style={[styles.iconBtn, polygonCoords.length === 0 && styles.iconBtnDisabled]}
                                >
                                    <Ionicons name="trash-outline" size={18} color={polygonCoords.length > 0 ? '#EF5350' : '#B0BEC5'} />
                                </Pressable>
                                <Pressable
                                    onPress={fetchCurrentLocation}
                                    disabled={isFetchingLocation}
                                    style={styles.iconBtn}
                                >
                                    {isFetchingLocation
                                        ? <ActivityIndicator size="small" color={PRIMARY} />
                                        : <MaterialIcons name="my-location" size={18} color={PRIMARY} />}
                                </Pressable>
                            </View>
                        </View>

                        {/* ── Tap-hint banner (drawing mode only) ── */}
                        {isDrawingMode && (
                            <View style={styles.hintBanner}>
                                <Ionicons name="hand-left-outline" size={14} color="#fff" />
                                <Text style={styles.hintText}>Tap anywhere on the map to add a point</Text>
                            </View>
                        )}
                    </View>

                    {/* ── Bottom panel: name + save ── */}
                    <View style={styles.panel}>
                        <View style={styles.inputRow}>
                            <Ionicons name="pricetag-outline" size={16} color="#8F94A4" style={{ marginRight: 8 }} />
                            <BottomSheetTextInput
                                value={locationName}
                                onChangeText={setLocationName}
                                placeholder="Location name  (e.g. LT 201)"
                                placeholderTextColor="#4A5568"
                                style={styles.textInput}
                            />
                        </View>

                        <Pressable
                            onPress={handleSave}
                            disabled={!canSave || isLoading}
                            style={[styles.saveBtn, canSave ? styles.saveBtnActive : styles.saveBtnDisabled]}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={18}
                                        color={canSave ? '#fff' : '#4A5568'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[styles.saveBtnText, !canSave && { color: '#4A5568' }]}>
                                        Save Boundary
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

SetPolygonLocationBottomSheet.displayName = 'SetPolygonLocationBottomSheet';

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#0F1117',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    handleIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    container: {
        flex: 1,
    },
    mapWrapper: {
        flex: 1,
        overflow: 'hidden',
    },
    // ── Floating header ──
    floatingHeader: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.58)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    headerTitle: {
        fontFamily: 'WorkSans_600SemiBold',
        fontSize: 15,
        color: '#fff',
    },
    headerSub: {
        fontFamily: 'WorkSans_400Regular',
        fontSize: 12,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    // ── Status pill ──
    statusPill: {
        position: 'absolute',
        top: 78,
        alignSelf: 'center',
        left: 40,
        right: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontFamily: 'WorkSans_500Medium',
        fontSize: 12,
        color: '#fff',
    },
    // ── Floating controls ──
    floatingControls: {
        position: 'absolute',
        bottom: 16,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    drawToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    drawToggleActive: {
        backgroundColor: PRIMARY,
    },
    drawToggleText: {
        fontFamily: 'WorkSans_600SemiBold',
        fontSize: 13,
        color: PRIMARY,
        marginLeft: 6,
    },
    iconGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        width: 42,
        height: 42,
        borderRadius: 13,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    iconBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    // ── Tap-hint banner ──
    hintBanner: {
        position: 'absolute',
        bottom: 72,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PRIMARY,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    hintText: {
        fontFamily: 'WorkSans_400Regular',
        fontSize: 12,
        color: '#fff',
        marginLeft: 6,
    },
    // ── Bottom panel ──
    panel: {
        backgroundColor: '#1A1D2E',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252A3D',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 50,
        marginBottom: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'WorkSans_400Regular',
        color: '#fff',
    },
    saveBtn: {
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnActive: {
        backgroundColor: PRIMARY,
    },
    saveBtnDisabled: {
        backgroundColor: '#252A3D',
    },
    saveBtnText: {
        fontFamily: 'WorkSans_600SemiBold',
        fontSize: 15,
        color: '#fff',
    },
    // ── Map markers ──
    dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    dotFirst: {
        backgroundColor: SUCCESS,
    },
    dotLabel: {
        color: '#fff',
        fontSize: 10,
        fontFamily: 'WorkSans_700Bold',
    },
});
