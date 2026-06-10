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

export const SetBoundaryBottomSheet = forwardRef<SetBoundaryBottomSheetRef, Props>(
    ({ classCode, onSaveLocation, existingLocation }, ref) => {
        const bsRef = useRef<BottomSheetModal>(null);
        const mapRef = useRef<MapView>(null);
        const insets = useSafeAreaInsets();
        const { height: WINDOW_H } = useWindowDimensions();
        const mapAreaHeight = WINDOW_H * 0.96 - 28 - 142 - Math.max(insets.bottom, 16);
        const pulseAnim = useRef(new Animated.Value(1)).current;

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

        // Points dropped by the user standing at each corner
        const [points, setPoints] = useState<BoundaryCoordinate[]>([]);
        const [isSampling, setIsSampling] = useState(false);
        const [samplingStep, setSamplingStep] = useState(0); // 1-3 while reading

        const snapPoints = useMemo(() => ['72%', '96%'], []);

        // Pulse while sampling a new GPS point
        useEffect(() => {
            if (isSampling) {
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
        }, [isSampling]);

        const resetAll = () => {
            setLocationName('');
            setCircleCenter(null);
            setRadius(50);
            setPoints([]);
            setIsSampling(false);
            setSamplingStep(0);
        };

        const goToManual = () => {
            setPage('manual');
            setTimeout(() => bsRef.current?.snapToIndex(1), 80);
        };

        const goToPicker = () => {
            setIsSampling(false);
            setSamplingStep(0);
            setPage('picker');
            bsRef.current?.snapToIndex(0);
        };

        useImperativeHandle(ref, () => ({
            open: () => {
                resetAll();
                if (existingLocation) {
                    setLocationName(existingLocation.name || '');
                    if (existingLocation.polygonCoords?.length) {
                        setPoints(existingLocation.polygonCoords);
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

        /**
         * Stand at a corner, press this — it takes 3 GPS readings 1 s apart
         * and keeps the one with the smallest accuracy radius (most precise).
         */
        const dropPoint = async () => {
            const ok = await ensureLocationPermission(() => {});
            if (!ok) return;
            setIsSampling(true);
            try {
                const samples: Location.LocationObject[] = [];
                for (let i = 0; i < 3; i++) {
                    setSamplingStep(i + 1);
                    const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.BestForNavigation,
                    });
                    samples.push(loc);
                    if (i < 2) await new Promise<void>((r) => setTimeout(r, 1_000));
                }
                const best = samples.reduce((a, b) =>
                    (a.coords.accuracy ?? Infinity) <= (b.coords.accuracy ?? Infinity) ? a : b,
                );
                const pt: BoundaryCoordinate = {
                    latitude: best.coords.latitude,
                    longitude: best.coords.longitude,
                };
                setPoints((prev) => [...prev, pt]);
                mapRef.current?.animateToRegion({
                    latitude: pt.latitude,
                    longitude: pt.longitude,
                    latitudeDelta: 0.0005,
                    longitudeDelta: 0.0005,
                }, 300);
            } catch {
                Toast.show({ type: 'error', text1: 'Could not get a precise fix. Move to an open area and try again.', position: 'bottom' });
            } finally {
                setIsSampling(false);
                setSamplingStep(0);
            }
        };

        const undo = () => setPoints((prev) => prev.slice(0, -1));
        const clear = () => setPoints([]);

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

        const savePoints = () => {
            if (!locationName.trim()) {
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: 'bottom' });
                return;
            }
            if (points.length < 3) {
                Toast.show({ type: 'error', text1: 'Drop at least 3 points to form a boundary', position: 'bottom' });
                return;
            }
            setIsLoading(true);
            const center = calcCenter(points);
            setTimeout(() => {
                onSaveLocation({ ...center, polygonCoords: points, name: locationName.trim() });
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

        const isPointsReady = points.length >= 3;
        const canSavePoints = locationName.trim().length > 0 && isPointsReady;
        const canSaveGeo = locationName.trim().length > 0 && circleCenter !== null;

        const pointStatusColor = isPointsReady ? SUCCESS : isSampling ? WARNING : '#BCBDC0';
        const pointStatusText = isSampling
            ? 'Sampling… getting best reading'
            : isPointsReady
                ? `${points.length} point${points.length !== 1 ? 's' : ''} · Boundary ready ✓`
                : `${points.length} point${points.length !== 1 ? 's' : ''} · Need ${Math.max(0, 3 - points.length)} more`;

        const polyCoords = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));

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
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Set Class Location</Text>
                                <Text style={styles.subtitle}>{classCode}</Text>
                            </View>
                            <Pressable onPress={() => bsRef.current?.dismiss()} style={styles.closeBtn}>
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>

                        <Text style={styles.pickerPrompt}>
                            Choose how you want to define the attendance boundary for this class.
                        </Text>

                        {/* ── Geofence Radius Card ── */}
                        <Pressable
                            onPress={() => setPage('geofence')}
                            style={({ pressed }) => [styles.bigCard, pressed && styles.bigCardPressed]}
                        >
                            <View style={[styles.bigCardBand, { backgroundColor: '#EEF2FF' }]}>
                                <View style={styles.bigCardIconWrap}>
                                    <Ionicons name="radio-button-on" size={36} color={PRIMARY} />
                                </View>
                                <View style={styles.bigCardBadge}>
                                    <Text style={styles.bigCardBadgeText}>Quick Setup</Text>
                                </View>
                            </View>
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

                        {/* ── Drop Points Card ── */}
                        <Pressable
                            onPress={goToManual}
                            style={({ pressed }) => [styles.bigCard, pressed && styles.bigCardPressed]}
                        >
                            <View style={[styles.bigCardBand, { backgroundColor: '#F0FDF4' }]}>
                                <View style={styles.bigCardIconWrap}>
                                    <Ionicons name="location" size={36} color={SUCCESS} />
                                </View>
                                <View style={[styles.bigCardBadge, { backgroundColor: '#DCFCE7' }]}>
                                    <Text style={[styles.bigCardBadgeText, { color: '#166534' }]}>Recommended</Text>
                                </View>
                            </View>
                            <View style={styles.bigCardBody}>
                                <Text style={styles.bigCardTitle}>Drop Points</Text>
                                <Text style={styles.bigCardDesc}>
                                    Stand at each corner of your venue and drop a GPS point. The app takes
                                    3 readings and picks the most precise one. Ideal for labs, halls, and irregular spaces.
                                </Text>
                                <View style={styles.bigCardTags}>
                                    <View style={[styles.bigCardTag, { backgroundColor: '#F0FDF4' }]}>
                                        <Ionicons name="checkmark-circle" size={11} color={SUCCESS} />
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

                {/* ═══════════════ DROP POINTS MAP ═══════════════ */}
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
                                {/* Numbered markers at each dropped point */}
                                {polyCoords.map((coord, i) => (
                                    <Marker
                                        key={i}
                                        coordinate={coord}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        tracksViewChanges={false}
                                    >
                                        <View style={[styles.vertex, i === 0 && styles.vertexFirst]}>
                                            <Text style={styles.vertexText}>{i + 1}</Text>
                                        </View>
                                    </Marker>
                                ))}

                                {/* Dashed connecting line between points */}
                                {polyCoords.length >= 2 && (
                                    <Polyline
                                        coordinates={polyCoords}
                                        strokeColor="rgba(99,67,204,0.9)"
                                        strokeWidth={2}
                                        lineDashPattern={[8, 4]}
                                    />
                                )}

                                {/* Filled polygon once ≥3 points */}
                                {polyCoords.length >= 3 && (
                                    <Polygon
                                        coordinates={polyCoords}
                                        fillColor="rgba(99,67,204,0.18)"
                                        strokeColor="rgba(99,67,204,0.9)"
                                        strokeWidth={2.5}
                                    />
                                )}
                            </MapView>

                            {/* Floating header */}
                            <View style={styles.mapHeader}>
                                <Pressable onPress={goToPicker} style={styles.mapNavBtn}>
                                    <Ionicons name="arrow-back" size={18} color="#fff" />
                                </Pressable>
                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                    <Text style={styles.mapHeaderTitle}>Drop Points</Text>
                                    <Text style={styles.mapHeaderSub}>{classCode}</Text>
                                </View>
                                <Pressable onPress={() => bsRef.current?.dismiss()} style={styles.mapNavBtn}>
                                    <Ionicons name="close" size={18} color="#fff" />
                                </Pressable>
                            </View>

                            {/* Status pill */}
                            <View style={styles.statusPill}>
                                <View style={[styles.statusDot, { backgroundColor: pointStatusColor }]} />
                                <Text style={styles.statusText}>{pointStatusText}</Text>
                            </View>

                            {/* Instruction / progress banner */}
                            {!isPointsReady && !isSampling && (
                                <View style={[styles.hintBanner, { backgroundColor: 'rgba(0,0,0,0.60)' }]}>
                                    <Ionicons name="location" size={14} color="#fff" />
                                    <Text style={styles.hintText}>
                                        Stand at each corner of the venue and press Drop Point
                                    </Text>
                                </View>
                            )}
                            {isSampling && (
                                <View style={[styles.hintBanner, styles.hintBannerTall, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
                                    <Text style={styles.hintText}>
                                        Hold still · Reading {samplingStep} of 3
                                    </Text>
                                    <View style={styles.progressTrack}>
                                        {[1, 2, 3].map((step) => (
                                            <View
                                                key={step}
                                                style={[
                                                    styles.progressSegment,
                                                    step <= samplingStep
                                                        ? styles.progressSegmentDone
                                                        : styles.progressSegmentPending,
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                            {isPointsReady && !isSampling && (
                                <View style={[styles.hintBanner, { backgroundColor: 'rgba(34,197,94,0.85)' }]}>
                                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                                    <Text style={styles.hintText}>
                                        Boundary ready · enter a name below and tap Save
                                    </Text>
                                </View>
                            )}

                            {/* Controls */}
                            <View style={styles.walkControls}>
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <Pressable
                                        onPress={dropPoint}
                                        disabled={isSampling}
                                        style={[styles.walkBtn, isSampling ? { backgroundColor: WARNING } : { backgroundColor: SUCCESS }]}
                                    >
                                        <Ionicons name="location" size={18} color="#fff" />
                                        <Text style={styles.walkBtnText}>
                                            {isSampling
                                                ? `Reading ${samplingStep}/3…`
                                                : `Drop Point${points.length > 0 ? ` (${points.length})` : ''}`}
                                        </Text>
                                    </Pressable>
                                </Animated.View>

                                <View style={styles.walkIconGroup}>
                                    <Pressable
                                        onPress={undo}
                                        disabled={points.length === 0 || isSampling}
                                        style={[styles.mapIconBtn, (points.length === 0 || isSampling) && styles.mapIconBtnOff]}
                                    >
                                        <Ionicons name="arrow-undo" size={18} color={points.length > 0 && !isSampling ? '#FF9800' : '#B0BEC5'} />
                                    </Pressable>
                                    <Pressable
                                        onPress={clear}
                                        disabled={points.length === 0 || isSampling}
                                        style={[styles.mapIconBtn, (points.length === 0 || isSampling) && styles.mapIconBtnOff]}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={points.length > 0 && !isSampling ? DANGER : '#B0BEC5'} />
                                    </Pressable>
                                    <Pressable
                                        onPress={fetchCurrentLocation}
                                        disabled={isFetchingLocation}
                                        style={styles.mapIconBtn}
                                    >
                                        {isFetchingLocation
                                            ? <ActivityIndicator size="small" color={PRIMARY} />
                                            : <MaterialIcons name="my-location" size={18} color={PRIMARY} />}
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* Bottom panel */}
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
                                onPress={savePoints}
                                disabled={!canSavePoints || isLoading}
                                style={[styles.saveBtn, canSavePoints ? styles.saveBtnOn : styles.saveBtnOff]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color={canSavePoints ? '#fff' : '#B8BBC6'} style={{ marginRight: 6 }} />
                                        <Text style={[styles.saveBtnText, !canSavePoints && { color: '#B8BBC6' }]}>Save Boundary</Text>
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
    hintBannerTall: { flexDirection: 'column', paddingVertical: 12 },
    hintText: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#fff', marginLeft: 6 },
    progressTrack: { flexDirection: 'row', gap: 6, marginTop: 8 },
    progressSegment: { height: 5, flex: 1, borderRadius: 3 },
    progressSegmentDone: { backgroundColor: SUCCESS },
    progressSegmentPending: { backgroundColor: 'rgba(255,255,255,0.25)' },

    walkControls: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    walkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    walkBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 14, color: '#fff' },
    walkIconGroup: { flexDirection: 'row', gap: 8 },
    mapIconBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
    mapIconBtnOff: { backgroundColor: 'rgba(255,255,255,0.45)' },

    vertex: { width: 26, height: 26, borderRadius: 13, backgroundColor: PRIMARY, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
    vertexFirst: { backgroundColor: SUCCESS },
    vertexText: { color: '#fff', fontWeight: '800', fontSize: 12 },

    lightPanel: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EAF1', paddingHorizontal: 16, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: -3 }, shadowRadius: 10, elevation: 10 },
    lightInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 10 },
    lightTextInput: { flex: 1, fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#181A20' },
});
