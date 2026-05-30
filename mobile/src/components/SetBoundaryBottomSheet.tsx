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
    ActivityIndicator,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetScrollView,
    type BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import MapView, {
    Marker,
    Polygon,
    Polyline,
    PROVIDER_GOOGLE,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

const PRIMARY = '#6343cc';
const SUCCESS = '#22C55E';
const WARNING = '#FFA726';
const DANGER = '#EF5350';
const BG = '#F6F6F9';

const RADIUS_OPTIONS = [30, 50, 100, 150, 200];
const WALK_MIN_DISTANCE_M = 1; // 1 m — tiny areas need dense points

type Page = 'picker' | 'geofence' | 'manual';

export interface BoundaryCoordinate {
    latitude: number;
    longitude: number;
}

export interface ClassBoundary {
    latitude: number;
    longitude: number;
    radius?: number;
    polygonCoords?: BoundaryCoordinate[];
    name: string;
}

export interface SetBoundaryBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface Props {
    classCode: string;
    onSaveLocation: (location: ClassBoundary) => void;
    existingLocation?: ClassBoundary | null;
}

function calcCenter(coords: BoundaryCoordinate[]): BoundaryCoordinate {
    if (!coords.length) return { latitude: 0, longitude: 0 };
    const s = coords.reduce(
        (a, c) => ({ latitude: a.latitude + c.latitude, longitude: a.longitude + c.longitude }),
        { latitude: 0, longitude: 0 },
    );
    return { latitude: s.latitude / coords.length, longitude: s.longitude / coords.length };
}

function haversine(a: BoundaryCoordinate, b: BoundaryCoordinate): number {
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

export const SetBoundaryBottomSheet = forwardRef<SetBoundaryBottomSheetRef, Props>(
    ({ classCode, onSaveLocation, existingLocation }, ref) => {
        const bsRef = useRef<BottomSheetModal>(null);
        const mapRef = useRef<MapView>(null);
        const insets = useSafeAreaInsets();
        const { height: WINDOW_H } = useWindowDimensions();
        // Explicit map height: 96% sheet - handle (~28px) - bottom panel (~142px) - safe area bottom
        const mapAreaHeight = WINDOW_H * 0.96 - 28 - 142 - Math.max(insets.bottom, 16);
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const walkSubRef = useRef<Location.LocationSubscription | null>(null);

        const [page, setPage] = useState<Page>('picker');

        const [locationName, setLocationName] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [isFetchingLocation, setIsFetchingLocation] = useState(false);
        const [mapRegion, setMapRegion] = useState({
            latitude: 7.2266, longitude: 3.4400,
            latitudeDelta: 0.002, longitudeDelta: 0.002,
        });

        const [circleCenter, setCircleCenter] = useState<BoundaryCoordinate | null>(null);
        const [radius, setRadius] = useState(50);

        const [walkCoords, setWalkCoords] = useState<BoundaryCoordinate[]>([]);
        const [livePos, setLivePos] = useState<BoundaryCoordinate | null>(null);
        const [isWalking, setIsWalking] = useState(false);
        const [totalWalkDistance, setTotalWalkDistance] = useState(0);
        const lastWalkPoint = useRef<BoundaryCoordinate | null>(null);

        const snapPoints = useMemo(() => ['72%', '96%'], []);

        useEffect(() => {
            if (isWalking) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                    ]),
                ).start();
            } else {
                pulseAnim.stopAnimation();
                pulseAnim.setValue(1);
            }
        }, [isWalking]);

        useEffect(() => () => { walkSubRef.current?.remove(); }, []);

        const resetAll = () => {
            setLocationName('');
            setCircleCenter(null);
            setRadius(50);
            setWalkCoords([]);
            setLivePos(null);
            setIsWalking(false);
            setTotalWalkDistance(0);
            lastWalkPoint.current = null;
            walkSubRef.current?.remove();
            walkSubRef.current = null;
        };

        const goToManual = () => {
            setPage('manual');
            setTimeout(() => bsRef.current?.snapToIndex(1), 80);
        };

        const goToPicker = () => {
            stopWalking();
            setPage('picker');
            bsRef.current?.snapToIndex(0);
        };

        useImperativeHandle(ref, () => ({
            open: () => {
                resetAll();
                // Pre-populate fields from existing location but always show the picker
                // so the user can choose between Geofence Radius and Perimeter Walk
                if (existingLocation) {
                    setLocationName(existingLocation.name || '');
                    if (existingLocation.polygonCoords?.length) {
                        setWalkCoords(existingLocation.polygonCoords);
                    } else {
                        setCircleCenter({ latitude: existingLocation.latitude, longitude: existingLocation.longitude });
                        setRadius(existingLocation.radius ?? 50);
                    }
                }
                setPage('picker');
                bsRef.current?.present();
                fetchCurrentLocation();
            },
            close: () => bsRef.current?.dismiss(),
        }));

        const fetchCurrentLocation = async () => {
            setIsFetchingLocation(true);
            try {
                const ok = await ensureLocationPermission(() => setIsFetchingLocation(false));
                if (!ok) { setIsFetchingLocation(false); return; }
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                const r = {
                    latitude: loc.coords.latitude, longitude: loc.coords.longitude,
                    latitudeDelta: 0.002, longitudeDelta: 0.002,
                };
                setMapRegion(r);
                mapRef.current?.animateToRegion(r, 500);
                setCircleCenter(prev => prev ?? { latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } catch { /* silent */ } finally {
                setIsFetchingLocation(false);
            }
        };

        const startWalking = async () => {
            const ok = await ensureLocationPermission(() => { });
            if (!ok) return;
            lastWalkPoint.current = null;
            const sub = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 400,      // update every 400 ms for a live line feel
                    distanceInterval: 0,    // no distance gate — we gate manually below
                },
                (loc) => {
                    const pt: BoundaryCoordinate = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

                    // Always update live position so the line tip follows the user in real-time
                    setLivePos(pt);

                    // Only record a boundary point when moved at least WALK_MIN_DISTANCE_M
                    const distFromLast = lastWalkPoint.current ? haversine(lastWalkPoint.current, pt) : Infinity;
                    if (distFromLast >= WALK_MIN_DISTANCE_M) {
                        setWalkCoords(prev => [...prev, pt]);
                        if (lastWalkPoint.current) {
                            setTotalWalkDistance(prev => prev + distFromLast);
                        }
                        lastWalkPoint.current = pt;
                    }

                    // Keep map tightly zoomed in on the user (~30 m view) while walking
                    mapRef.current?.animateToRegion({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        latitudeDelta: 0.0003,
                        longitudeDelta: 0.0003,
                    }, 200);
                },
            );
            walkSubRef.current = sub;
            setIsWalking(true);
        };

        const stopWalking = () => {
            walkSubRef.current?.remove();
            walkSubRef.current = null;
            setIsWalking(false);
        };

        const saveGeofence = () => {
            if (!locationName.trim()) {
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: 'bottom' });
                return;
            }
            if (!circleCenter) {
                Toast.show({ type: 'error', text1: 'Capture your GPS position first', position: 'bottom' });
                return;
            }
            setIsLoading(true);
            setTimeout(() => {
                onSaveLocation({ ...circleCenter, radius, name: locationName.trim() });
                setIsLoading(false);
                bsRef.current?.dismiss();
            }, 300);
        };

        const saveManual = () => {
            if (!locationName.trim()) {
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: 'bottom' });
                return;
            }
            if (walkCoords.length < 3) {
                Toast.show({ type: 'error', text1: 'Walk at least 3 GPS points to form a boundary', position: 'bottom' });
                return;
            }
            if (isWalking) stopWalking();
            setIsLoading(true);
            const center = calcCenter(walkCoords);
            setTimeout(() => {
                onSaveLocation({ ...center, polygonCoords: walkCoords, name: locationName.trim() });
                setIsLoading(false);
                bsRef.current?.dismiss();
            }, 300);
        };

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
            ),
            [],
        );

        const isWalkReady = walkCoords.length >= 3;
        const canSaveManual = locationName.trim().length > 0 && isWalkReady;
        const canSaveGeo = locationName.trim().length > 0 && circleCenter !== null;

        const walkStatusColor = isWalkReady ? SUCCESS : isWalking ? WARNING : '#BCBDC0';
        const walkStatusText = isWalking
            ? `Recording\u2026 ${walkCoords.length} pt${walkCoords.length !== 1 ? 's' : ''} \u00b7 ${totalWalkDistance.toFixed(0)} m`
            : isWalkReady
                ? `${walkCoords.length} pts \u00b7 ${totalWalkDistance.toFixed(0)} m \u00b7 Boundary ready \u2713`
                : 'Press Start to walk the perimeter';

        return (
            <BottomSheetModal
                ref={bsRef}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose
                keyboardBehavior="extend"
                android_keyboardInputMode="adjustResize"
                handleIndicatorStyle={styles.handle}
                backgroundStyle={styles.background}
            >
                {/* ═══════════════════ PICKER ═══════════════════ */}
                {page === 'picker' && (
                    <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
                        {/* Header */}
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Set Class Location</Text>
                                <Text style={styles.subtitle}>{classCode}</Text>
                            </View>
                            <Pressable onPress={() => bsRef.current?.dismiss()} style={styles.closeBtn}>
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>

                        {/* Subtitle prompt */}
                        <Text style={styles.pickerPrompt}>
                            Choose how you want to define the attendance boundary for this class.
                        </Text>

                        {/* ── Geofence Radius Card ── */}
                        <Pressable
                            onPress={() => setPage('geofence')}
                            style={({ pressed }) => [styles.bigCard, pressed && styles.bigCardPressed]}
                        >
                            {/* Coloured header band */}
                            <View style={[styles.bigCardBand, { backgroundColor: '#EEF2FF' }]}>
                                <View style={styles.bigCardIconWrap}>
                                    <Ionicons name="radio-button-on" size={36} color={PRIMARY} />
                                </View>
                                <View style={styles.bigCardBadge}>
                                    <Text style={styles.bigCardBadgeText}>Quick Setup</Text>
                                </View>
                            </View>

                            {/* Body */}
                            <View style={styles.bigCardBody}>
                                <Text style={styles.bigCardTitle}>Geofence Radius</Text>
                                <Text style={styles.bigCardDesc}>
                                    Stand at the class location, capture your GPS pin, then choose a fixed radius.
                                    Perfect for standard classrooms and lecture halls.
                                </Text>
                                <View style={styles.bigCardTags}>
                                    <View style={[styles.bigCardTag, { backgroundColor: '#EEF2FF' }]}>
                                        <Ionicons name="flash" size={11} color={PRIMARY} />
                                        <Text style={[styles.bigCardTagText, { color: PRIMARY }]}>Fast</Text>
                                    </View>
                                    <View style={[styles.bigCardTag, { backgroundColor: '#EEF2FF' }]}>
                                        <Ionicons name="school" size={11} color={PRIMARY} />
                                        <Text style={[styles.bigCardTagText, { color: PRIMARY }]}>Classrooms</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.bigCardArrow}>
                                <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
                            </View>
                        </Pressable>

                        {/* ── Perimeter Walk Card ── */}
                        <Pressable
                            onPress={goToManual}
                            style={({ pressed }) => [styles.bigCard, pressed && styles.bigCardPressed]}
                        >
                            {/* Coloured header band */}
                            <View style={[styles.bigCardBand, { backgroundColor: '#F0FDF4' }]}>
                                <View style={styles.bigCardIconWrap}>
                                    <MaterialIcons name="directions-walk" size={36} color={SUCCESS} />
                                </View>
                                <View style={[styles.bigCardBadge, { backgroundColor: '#DCFCE7' }]}>
                                    <Text style={[styles.bigCardBadgeText, { color: '#166534' }]}>Recommended</Text>
                                </View>
                            </View>

                            {/* Body */}
                            <View style={styles.bigCardBody}>
                                <Text style={styles.bigCardTitle}>Perimeter Walk</Text>
                                <Text style={styles.bigCardDesc}>
                                    Walk the boundary of your venue while GPS traces your path automatically.
                                    Ideal for labs, open fields, and irregular spaces.
                                </Text>
                                <View style={styles.bigCardTags}>
                                    <View style={[styles.bigCardTag, { backgroundColor: '#F0FDF4' }]}>
                                        <MaterialIcons name="precision-manufacturing" size={11} color={SUCCESS} />
                                        <Text style={[styles.bigCardTagText, { color: '#166534' }]}>Precise</Text>
                                    </View>
                                    <View style={[styles.bigCardTag, { backgroundColor: '#F0FDF4' }]}>
                                        <MaterialIcons name="terrain" size={11} color={SUCCESS} />
                                        <Text style={[styles.bigCardTagText, { color: '#166534' }]}>Any Shape</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.bigCardArrow, { backgroundColor: '#F0FDF4' }]}>
                                <Ionicons name="arrow-forward" size={18} color={SUCCESS} />
                            </View>
                        </Pressable>
                    </BottomSheetScrollView>
                )}

                {/* ════════════════ GEOFENCE FORM ════════════════ */}
                {page === 'geofence' && (
                    <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.row}>
                            <Pressable onPress={() => setPage('picker')} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                            </Pressable>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.title}>Geofence Radius</Text>
                                <Text style={styles.subtitle}>{classCode}</Text>
                            </View>
                            <Pressable onPress={() => bsRef.current?.dismiss()} style={styles.closeBtn}>
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>

                        <View style={styles.infoBanner}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="information" size={18} color="#FF8F00" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoTitle}>How it works</Text>
                                <Text style={styles.infoText}>
                                    Stand at the class location and capture your GPS position. Students must be
                                    within the chosen radius to be marked as present.
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.label}>Location Name</Text>
                        <View style={styles.inputWrap}>
                            <Ionicons name="pricetag-outline" size={18} color="#8F94A4" />
                            <BottomSheetTextInput
                                value={locationName}
                                onChangeText={setLocationName}
                                placeholder="e.g., LT 201, Faculty Building A"
                                placeholderTextColor="#B8BBC6"
                                style={styles.textInput}
                            />
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>GPS Coordinates</Text>
                        <View style={styles.card}>
                            {circleCenter ? (
                                <View style={styles.row}>
                                    <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.cardTitle}>Location Captured</Text>
                                        <Text style={styles.cardSub}>
                                            {circleCenter.latitude.toFixed(6)}, {circleCenter.longitude.toFixed(6)}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={fetchCurrentLocation}
                                        style={[styles.iconCircle, { backgroundColor: '#F0EDFC' }]}
                                    >
                                        {isFetchingLocation
                                            ? <ActivityIndicator size="small" color={PRIMARY} />
                                            : <Ionicons name="refresh" size={18} color={PRIMARY} />}
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable onPress={fetchCurrentLocation} disabled={isFetchingLocation} style={styles.rowCenter}>
                                    {isFetchingLocation ? (
                                        <>
                                            <ActivityIndicator size="small" color={PRIMARY} />
                                            <Text style={[styles.cardTitle, { marginLeft: 12, color: PRIMARY }]}>Getting location…</Text>
                                        </>
                                    ) : (
                                        <>
                                            <View style={[styles.iconCircle, { backgroundColor: '#F0EDFC' }]}>
                                                <MaterialIcons name="my-location" size={22} color={PRIMARY} />
                                            </View>
                                            <View style={{ marginLeft: 12 }}>
                                                <Text style={styles.cardTitle}>Capture Current Location</Text>
                                                <Text style={styles.cardSub}>Tap to get GPS coordinates</Text>
                                            </View>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Geofence Radius</Text>
                        <View style={styles.radiusRow}>
                            {RADIUS_OPTIONS.map(r => (
                                <Pressable
                                    key={r}
                                    onPress={() => setRadius(r)}
                                    style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
                                >
                                    <Text style={[styles.radiusChipText, radius === r && { color: '#fff' }]}>
                                        {r}m
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={styles.radiusHint}>
                            Students must be within {radius} meters to be considered present
                        </Text>

                        <Pressable
                            onPress={saveGeofence}
                            disabled={!canSaveGeo || isLoading}
                            style={[styles.saveBtn, canSaveGeo ? styles.saveBtnOn : styles.saveBtnOff, { marginTop: 24 }]}
                        >
                            {isLoading
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={[styles.saveBtnText, !canSaveGeo && { color: '#B8BBC6' }]}>Save Location</Text>}
                        </Pressable>
                    </BottomSheetScrollView>
                )}

                {/* ═══════════════ PERIMETER WALK MAP ═══════════════ */}
                {page === 'manual' && (
                    <BottomSheetView style={styles.mapShell}>
                        <View style={[styles.mapArea, { height: mapAreaHeight }]}>
                            <MapView
                                ref={mapRef}
                                style={StyleSheet.absoluteFill}
                                provider={PROVIDER_GOOGLE}
                                initialRegion={mapRegion}
                                showsUserLocation
                                showsMyLocationButton={false}
                                mapType="satellite"
                            >
                                {/* First recorded point marker */}
                                {walkCoords.length > 0 && (
                                    <Marker
                                        key="start"
                                        coordinate={walkCoords[0]}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        tracksViewChanges={false}
                                    >
                                        <View style={styles.walkDotFirst} />
                                    </Marker>
                                )}

                                {/* Path walked so far + live tip extending to current position */}
                                {(walkCoords.length >= 1 || livePos) && (
                                    <>
                                        {/* Glow / shadow line behind the main line */}
                                        <Polyline
                                            coordinates={livePos ? [...walkCoords, livePos] : walkCoords}
                                            strokeColor="rgba(255,255,255,0.35)"
                                            strokeWidth={7}
                                            lineCap="round"
                                            lineJoin="round"
                                        />
                                        {/* Main path line */}
                                        <Polyline
                                            coordinates={livePos ? [...walkCoords, livePos] : walkCoords}
                                            strokeColor="rgba(99,67,204,1)"
                                            strokeWidth={4}
                                            lineCap="round"
                                            lineJoin="round"
                                        />
                                    </>
                                )}

                                {/* Closing line back to start once ≥3 points */}
                                {walkCoords.length >= 3 && (
                                    <Polygon
                                        coordinates={walkCoords}
                                        fillColor="rgba(99,67,204,0.18)"
                                        strokeColor="transparent"
                                        strokeWidth={0}
                                    />
                                )}
                            </MapView>

                            {/* Floating header */}
                            <View style={styles.mapHeader}>
                                <Pressable onPress={goToPicker} style={styles.mapNavBtn}>
                                    <Ionicons name="arrow-back" size={18} color="#fff" />
                                </Pressable>
                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                    <Text style={styles.mapHeaderTitle}>Perimeter Walk</Text>
                                    <Text style={styles.mapHeaderSub}>{classCode}</Text>
                                </View>
                                <Pressable onPress={() => bsRef.current?.dismiss()} style={styles.mapNavBtn}>
                                    <Ionicons name="close" size={18} color="#fff" />
                                </Pressable>
                            </View>

                            {/* Status pill */}
                            <View style={styles.statusPill}>
                                <View style={[styles.statusDot, { backgroundColor: walkStatusColor }]} />
                                <Text style={styles.statusText}>{walkStatusText}</Text>
                            </View>

                            {/* Hint banner */}
                            {isWalking && (
                                <View style={[styles.hintBanner, { backgroundColor: SUCCESS + 'DD' }]}>
                                    <MaterialIcons name="directions-walk" size={14} color="#fff" />
                                    <Text style={styles.hintText}>
                                        Walk the boundary area \u00b7 tap Stop when you've enclosed the space
                                    </Text>
                                </View>
                            )}
                            {!isWalking && isWalkReady && (
                                <View style={[styles.hintBanner, { backgroundColor: 'rgba(34,197,94,0.85)' }]}>
                                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                                    <Text style={styles.hintText}>Boundary recorded \u00b7 enter a name below and tap Save</Text>
                                </View>
                            )}

                            {/* Walk controls */}
                            <View style={styles.walkControls}>
                                {!isWalking ? (
                                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                        <Pressable
                                            onPress={startWalking}
                                            style={[styles.walkBtn, isWalkReady ? { backgroundColor: PRIMARY } : styles.walkBtnStart]}
                                        >
                                            <MaterialIcons name="directions-walk" size={18} color="#fff" />
                                            <Text style={styles.walkBtnText}>{walkCoords.length > 0 ? 'Resume Walk' : 'Start Walk'}</Text>
                                        </Pressable>
                                    </Animated.View>
                                ) : (
                                    <Pressable onPress={stopWalking} style={[styles.walkBtn, { backgroundColor: DANGER }]}>
                                        <Ionicons name="stop-circle-outline" size={18} color="#fff" />
                                        <Text style={styles.walkBtnText}>Stop</Text>
                                    </Pressable>
                                )}
                                <View style={styles.walkIconGroup}>
                                    <Pressable
                                        onPress={() => { stopWalking(); setWalkCoords([]); setLivePos(null); setTotalWalkDistance(0); lastWalkPoint.current = null; }}
                                        disabled={walkCoords.length === 0}
                                        style={[styles.mapIconBtn, walkCoords.length === 0 && styles.mapIconBtnOff]}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={walkCoords.length > 0 ? DANGER : '#B0BEC5'} />
                                    </Pressable>
                                    <Pressable onPress={fetchCurrentLocation} disabled={isFetchingLocation} style={styles.mapIconBtn}>
                                        {isFetchingLocation
                                            ? <ActivityIndicator size="small" color={PRIMARY} />
                                            : <MaterialIcons name="my-location" size={18} color={PRIMARY} />}
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* Light bottom panel */}
                        <View style={[styles.lightPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                            <View style={styles.lightInputRow}>
                                <Ionicons name="pricetag-outline" size={16} color="#8F94A4" style={{ marginRight: 8 }} />
                                <BottomSheetTextInput
                                    value={locationName}
                                    onChangeText={setLocationName}
                                    placeholder="Location name  (e.g. LT 201)"
                                    placeholderTextColor="#B8BBC6"
                                    style={styles.lightTextInput}
                                />
                            </View>
                            <Pressable
                                onPress={saveManual}
                                disabled={!canSaveManual || isLoading}
                                style={[styles.saveBtn, canSaveManual ? styles.saveBtnOn : styles.saveBtnOff]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color={canSaveManual ? '#fff' : '#B8BBC6'} style={{ marginRight: 6 }} />
                                        <Text style={[styles.saveBtnText, !canSaveManual && { color: '#B8BBC6' }]}>Save Boundary</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </BottomSheetView>
                )}
            </BottomSheetModal>
        );
    },
);

SetBoundaryBottomSheet.displayName = 'SetBoundaryBottomSheet';

const styles = StyleSheet.create({
    background: { backgroundColor: BG, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    handle: { width: 88, height: 4, borderRadius: 3, backgroundColor: '#BCBDC0', alignSelf: 'center' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },

    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    title: { fontFamily: 'WorkSans_600SemiBold', fontSize: 20, color: '#181A20' },
    subtitle: { fontFamily: 'WorkSans_400Regular', fontSize: 13, color: '#8F94A4', marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
    backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14, marginBottom: 20 },
    infoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFE082', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    infoTitle: { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#E65100', marginBottom: 3 },
    infoText: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#FF8F00', lineHeight: 18 },

    optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EAF1', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14 },
    optionCardPressed: { backgroundColor: '#F3F0FC', borderColor: PRIMARY },
    optionIcon: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    optionTitle: { fontFamily: 'WorkSans_600SemiBold', fontSize: 15, color: '#181A20', marginBottom: 4 },
    optionDesc: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#8F94A4', lineHeight: 18 },

    pickerPrompt: { fontFamily: 'WorkSans_400Regular', fontSize: 13, color: '#8F94A4', lineHeight: 20, marginBottom: 20, marginTop: -8 },

    bigCard: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EAF1', borderRadius: 20, marginBottom: 14, overflow: 'hidden' },
    bigCardPressed: { borderColor: PRIMARY, backgroundColor: '#FAFAFE' },
    bigCardBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
    bigCardIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
    bigCardBadge: { backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    bigCardBadgeText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 11, color: PRIMARY, letterSpacing: 0.3 },
    bigCardBody: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
    bigCardTitle: { fontFamily: 'WorkSans_700Bold', fontSize: 17, color: '#181A20', marginBottom: 6 },
    bigCardDesc: { fontFamily: 'WorkSans_400Regular', fontSize: 13, color: '#5A5D6B', lineHeight: 20, marginBottom: 12 },
    bigCardTags: { flexDirection: 'row', gap: 8 },
    bigCardTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    bigCardTagText: { fontFamily: 'WorkSans_500Medium', fontSize: 11 },
    bigCardArrow: { position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },

    label: { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#5A5D6B', marginBottom: 8 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1', paddingHorizontal: 14, gap: 10 },
    textInput: { flex: 1, fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#181A20' },
    card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1', borderRadius: 16, padding: 16 },
    cardTitle: { fontFamily: 'WorkSans_500Medium', fontSize: 14, color: '#181A20' },
    cardSub: { fontFamily: 'WorkSans_400Regular', fontSize: 11, color: '#8F94A4', marginTop: 2 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    radiusChip: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1' },
    radiusChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    radiusChipText: { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#5A5D6B' },
    radiusHint: { fontFamily: 'WorkSans_400Regular', fontSize: 11, color: '#8F94A4', textAlign: 'center' },

    saveBtn: { height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    saveBtnOn: { backgroundColor: PRIMARY },
    saveBtnOff: { backgroundColor: '#EDEDF3' },
    saveBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 16, color: '#fff' },

    mapShell: { flex: 1 },
    mapArea: { flex: 1, overflow: 'hidden' },

    mapHeader: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    mapNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    mapHeaderTitle: { fontFamily: 'WorkSans_600SemiBold', fontSize: 15, color: '#fff' },
    mapHeaderSub: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

    statusPill: { position: 'absolute', top: 78, left: 40, right: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
    statusText: { fontFamily: 'WorkSans_500Medium', fontSize: 12, color: '#fff' },

    hintBanner: { position: 'absolute', top: 128, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
    hintText: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#fff', marginLeft: 6 },

    walkControls: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    walkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    walkBtnStart: { backgroundColor: SUCCESS },
    walkBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 14, color: '#fff' },
    walkIconGroup: { flexDirection: 'row', gap: 8 },
    mapIconBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
    mapIconBtnOff: { backgroundColor: 'rgba(255,255,255,0.45)' },

    walkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(99,67,204,0.9)', borderWidth: 1.5, borderColor: '#fff' },
    walkDotFirst: { width: 14, height: 14, borderRadius: 7, backgroundColor: SUCCESS },

    lightPanel: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EAF1', paddingHorizontal: 16, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: -3 }, shadowRadius: 10, elevation: 10 },
    lightInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 10 },
    lightTextInput: { flex: 1, fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#181A20' },
});
