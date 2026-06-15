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

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#6343cc';
const SUCCESS = '#22C55E';
const WARNING = '#FFA726';
const DANGER  = '#EF5350';
const BG      = '#F6F6F9';

const RADIUS_OPTIONS = [30, 50, 100, 150, 200];

/**
 * Accuracy pipeline tuning:
 *
 * LOCK_TARGET_M      — We wait for the device to reach this accuracy before sampling.
 *                      5 m is achievable outdoors with a clear sky view.
 * LOCK_MAX_ATTEMPTS  — Max seconds we poll for the lock before proceeding anyway.
 * SAMPLE_COUNT       — Number of 1-second readings collected during sampling.
 * REJECT_ABOVE_M     — Individual samples worse than this are discarded before
 *                      the cluster step (gross error rejection).
 * MAX_SPEED_MS       — Discard readings where the device was moving (m/s).
 *                      0.3 m/s ≈ standing still with GPS jitter.
 */
const LOCK_TARGET_M     = 10;
const LOCK_MAX_ATTEMPTS = 20;
const SAMPLE_COUNT      = 12;
const REJECT_ABOVE_M    = 25;
const MAX_SPEED_MS      = 0.4;

const POINT_COLORS = [
    '#E91E63',
    '#FF9800',
    '#4CAF50',
    '#2196F3',
    '#9C27B0',
    '#00BCD4',
    '#FF5722',
    '#795548',
];

// ─── Accuracy utilities ───────────────────────────────────────────────────────

function getAccuracyColor(acc: number): string {
    if (acc <= 5)  return SUCCESS;
    if (acc <= 10) return '#8BC34A';
    if (acc <= 15) return WARNING;
    return DANGER;
}

/** Number of filled signal-bar segments (1-5) based on live GPS accuracy. */
function signalLevel(accuracy: number | null): number {
    if (accuracy === null) return 0;
    if (accuracy <= 5)  return 5;
    if (accuracy <= 8)  return 4;
    if (accuracy <= 12) return 3;
    if (accuracy <= 20) return 2;
    return 1;
}

/** Haversine great-circle distance between two points, in metres. */
function haversineM(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
): number {
    const R  = 6_371_000;
    const φ1 = (a.latitude  * Math.PI) / 180;
    const φ2 = (b.latitude  * Math.PI) / 180;
    const Δφ = ((b.latitude  - a.latitude)  * Math.PI) / 180;
    const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
    const h  =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * RANSAC-style cluster selection.
 *
 * 1. Find the sample whose median pairwise distance to all others is smallest
 *    (the most "representative" reading in the set).
 * 2. Discard samples farther than max(3 m, 2.5 × that median) from the centre.
 * 3. Fall back to the best-70% by raw accuracy if fewer than 3 inliers remain.
 */
function bestCluster(samples: Location.LocationObject[]): Location.LocationObject[] {
    if (samples.length <= 3) return samples;

    const coords = samples.map(l => ({
        latitude:  l.coords.latitude,
        longitude: l.coords.longitude,
    }));

    let bestMedian = Infinity;
    let centreIdx  = 0;
    for (let i = 0; i < coords.length; i++) {
        const dists = coords
            .map((c, j) => (j === i ? 0 : haversineM(coords[i], c)))
            .sort((a, b) => a - b);
        const median = dists[Math.floor(dists.length / 2)];
        if (median < bestMedian) { bestMedian = median; centreIdx = i; }
    }

    const centre  = coords[centreIdx];
    const cutoff  = Math.max(3, bestMedian * 2.5);
    const inliers = samples.filter((_, i) => haversineM(centre, coords[i]) <= cutoff);

    if (inliers.length >= 3) return inliers;

    // fallback — best 70% by raw accuracy
    return [...samples]
        .sort((a, b) => (a.coords.accuracy ?? 999) - (b.coords.accuracy ?? 999))
        .slice(0, Math.max(3, Math.ceil(samples.length * 0.7)));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'picker' | 'geofence' | 'manual';

export interface BoundaryCoordinate {
    latitude:  number;
    longitude: number;
}

export interface ClassBoundary {
    latitude:       number;
    longitude:      number;
    radius?:        number;
    polygonCoords?: BoundaryCoordinate[];
    name:           string;
}

export interface SetBoundaryBottomSheetRef {
    /** Pass `{ fresh: true }` to start a brand-new boundary (ignores existingLocation). */
    open:  (options?: { fresh?: boolean }) => void;
    close: () => void;
}

interface Props {
    classCode:         string;
    onSaveLocation:    (location: ClassBoundary) => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

export const SetBoundaryBottomSheet = forwardRef<SetBoundaryBottomSheetRef, Props>(
    ({ classCode, onSaveLocation, existingLocation }, ref) => {
        const bsRef    = useRef<BottomSheetModal>(null);
        const mapRef   = useRef<MapView>(null);
        const insets   = useSafeAreaInsets();
        const { height: WINDOW_H } = useWindowDimensions();
        const mapAreaHeight = WINDOW_H * 0.96 - 28 - 142 - Math.max(insets.bottom, 16);
        const pulseAnim = useRef(new Animated.Value(1)).current;

        const [page, setPage] = useState<Page>('picker');

        const [locationName,       setLocationName]       = useState('');
        const [isLoading,          setIsLoading]          = useState(false);
        const [isFetchingLocation, setIsFetchingLocation] = useState(false);
        const [mapRegion,          setMapRegion]          = useState({
            latitude: 7.2266, longitude: 3.4400,
            latitudeDelta: 0.002, longitudeDelta: 0.002,
        });

        const [circleCenter, setCircleCenter] = useState<BoundaryCoordinate | null>(null);
        const [radius,       setRadius]       = useState(50);

        const [points,          setPoints]          = useState<BoundaryCoordinate[]>([]);
        const [pointAccuracies, setPointAccuracies] = useState<number[]>([]);

        // GPS sampling state
        const [isSampling,       setIsSampling]       = useState(false);
        const [isWaitingForLock, setIsWaitingForLock] = useState(false);
        const [liveLockAccuracy, setLiveLockAccuracy] = useState<number | null>(null);
        const [samplingStep,     setSamplingStep]     = useState(0);
        const [retakingIndex,    setRetakingIndex]    = useState<number | null>(null);
        const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
        const [draggingIdx,      setDraggingIdx]      = useState<number | null>(null);

        // Always open at full height so the Save button is immediately visible
        const snapPoints = useMemo(() => ['96%'], []);

        useEffect(() => {
            if (isSampling) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
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
            setPointAccuracies([]);
            setIsSampling(false);
            setIsWaitingForLock(false);
            setLiveLockAccuracy(null);
            setSamplingStep(0);
            setRetakingIndex(null);
            setSelectedPointIdx(null);
            setDraggingIdx(null);
        };

        const goToManual = () => {
            setIsSampling(false);
            setIsWaitingForLock(false);
            setLiveLockAccuracy(null);
            setSamplingStep(0);
            setSelectedPointIdx(null);
            setRetakingIndex(null);
            setDraggingIdx(null);
            setPage('manual');
        };

        const goToPicker = () => {
            setIsSampling(false);
            setIsWaitingForLock(false);
            setLiveLockAccuracy(null);
            setSamplingStep(0);
            setSelectedPointIdx(null);
            setRetakingIndex(null);
            setDraggingIdx(null);
            setPage('picker');
        };

        useImperativeHandle(ref, () => ({
            open: (options) => {
                resetAll();
                // `fresh` starts a blank boundary; otherwise pre-load the existing
                // one so it can be edited.
                if (!options?.fresh && existingLocation) {
                    setLocationName(existingLocation.name || '');
                    if (existingLocation.polygonCoords?.length) {
                        setPoints(existingLocation.polygonCoords);
                        setPage('manual');
                        bsRef.current?.present();
                        fetchCurrentLocation();
                        return;
                    } else {
                        setCircleCenter({
                            latitude:  existingLocation.latitude,
                            longitude: existingLocation.longitude,
                        });
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
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                const r = {
                    latitude:      loc.coords.latitude,
                    longitude:     loc.coords.longitude,
                    latitudeDelta: 0.002,
                    longitudeDelta: 0.002,
                };
                setMapRegion(r);
                mapRef.current?.animateToRegion(r, 500);
                setCircleCenter(prev =>
                    prev ?? { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                );
            } catch { /* silent */ } finally {
                setIsFetchingLocation(false);
            }
        };

        /**
         * Maximum-accuracy GPS pipeline — four stages, all using watchPositionAsync.
         *
         * Stage 1 — Lock wait (streaming)
         *   Open a continuous CoreLocation stream (same as the iOS Compass app) and
         *   wait until reported accuracy reaches LOCK_TARGET_M, or LOCK_MAX_ATTEMPTS
         *   seconds pass. Streaming avoids the OS location cache that getCurrentPosition
         *   can return, guaranteeing every update is a fresh satellite fix.
         *
         * Stage 2 — Sample collection (same stream, kept open)
         *   Collect exactly SAMPLE_COUNT readings from the live stream. Each reading
         *   is a new satellite update — no duplicates, no cached values.
         *
         * Stage 3 — Gross error rejection
         *   Discard any sample whose reported accuracy is worse than REJECT_ABOVE_M,
         *   or where the device had a non-trivial speed (it was still settling).
         *
         * Stage 4 — RANSAC cluster + weighted average
         *   Find the tightest geometric cluster (removes multipath/satellite
         *   geometry outliers), keep the best 70% by reported accuracy, then
         *   compute a weighted average where weight = 1 / accuracy², so readings
         *   with a stronger satellite fix dominate the final coordinate.
         */
        const dropPoint = async (replaceIndex?: number) => {
            const ok = await ensureLocationPermission(() => {});
            if (!ok) return;

            setIsSampling(true);
            setIsWaitingForLock(true);
            setLiveLockAccuracy(null);
            setRetakingIndex(replaceIndex ?? null);
            setSelectedPointIdx(null);
            setSamplingStep(0);

            let subscription: Location.LocationSubscription | null = null;

            try {
                const raw: Location.LocationObject[] = [];

                await new Promise<void>((resolve, reject) => {
                    const deadline = setTimeout(() => resolve(), (LOCK_MAX_ATTEMPTS + SAMPLE_COUNT) * 1_500);

                    Location.watchPositionAsync(
                        {
                            accuracy:         Location.Accuracy.BestForNavigation,
                            timeInterval:     800,
                            distanceInterval: 0,
                        },
                        (loc) => {
                            const acc = loc.coords.accuracy ?? 999;

                            // ── Stage 1: lock wait ─────────────────────────────────
                            if (raw.length === 0) {
                                setLiveLockAccuracy(Math.round(acc * 10) / 10);
                                if (acc > LOCK_TARGET_M) return; // keep waiting
                                // Lock achieved — transition to sampling
                                setIsWaitingForLock(false);
                                setLiveLockAccuracy(null);
                            }

                            // ── Stage 2: collect samples ───────────────────────────
                            raw.push(loc);
                            setSamplingStep(raw.length);

                            if (raw.length >= SAMPLE_COUNT) {
                                clearTimeout(deadline);
                                resolve();
                            }
                        },
                    ).then(sub => {
                        subscription = sub;
                    }).catch(reject);
                });

                // Always stop the stream before processing
                subscription?.remove();
                subscription = null;

                // ── Stage 3: Gross error rejection ─────────────────────────────────
                const filtered = raw.filter(
                    l =>
                        (l.coords.accuracy ?? 999) < REJECT_ABOVE_M &&
                        (l.coords.speed === null || l.coords.speed <= MAX_SPEED_MS),
                );
                const pool = filtered.length >= 4 ? filtered : raw;

                // ── Stage 4: RANSAC cluster → top-70% → weighted average ───────────
                const cluster = bestCluster(pool);
                const sorted  = [...cluster].sort(
                    (a, b) => (a.coords.accuracy ?? 999) - (b.coords.accuracy ?? 999),
                );
                const top = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.7)));

                const weights  = top.map(l => 1 / Math.pow(Math.max(1, l.coords.accuracy ?? 5), 2));
                const totalW   = weights.reduce((s, w) => s + w, 0);
                const avgLat   = top.reduce((s, l, i) => s + l.coords.latitude  * weights[i], 0) / totalW;
                const avgLon   = top.reduce((s, l, i) => s + l.coords.longitude * weights[i], 0) / totalW;
                const avgAcc   = top.reduce((s, l)    => s + (l.coords.accuracy ?? 5),         0) / top.length;
                const finalAcc = Math.round(avgAcc * 10) / 10;

                const pt: BoundaryCoordinate = { latitude: avgLat, longitude: avgLon };

                if (replaceIndex !== undefined) {
                    setPoints(prev => prev.map((p, i) => (i === replaceIndex ? pt : p)));
                    setPointAccuracies(prev => prev.map((a, i) => (i === replaceIndex ? finalAcc : a)));
                } else {
                    setPoints(prev => [...prev, pt]);
                    setPointAccuracies(prev => [...prev, finalAcc]);
                }

                mapRef.current?.animateToRegion({
                    latitude:      pt.latitude,
                    longitude:     pt.longitude,
                    latitudeDelta: 0.0005,
                    longitudeDelta: 0.0005,
                }, 300);

                // Warn if the result was still noisy despite the pipeline
                if (avgAcc > 15) {
                    Toast.show({
                        type:  'info',
                        text1: `Point placed with ±${Math.round(avgAcc)} m accuracy`,
                        text2: 'For better results, stand outdoors with clear sky.',
                        position: 'bottom',
                    });
                }
            } catch {
                Toast.show({
                    type:  'error',
                    text1: 'GPS fix failed.',
                    text2: 'Move to an open outdoor area and try again.',
                    position: 'bottom',
                });
            } finally {
                subscription?.remove();
                setIsSampling(false);
                setIsWaitingForLock(false);
                setLiveLockAccuracy(null);
                setSamplingStep(0);
                setRetakingIndex(null);
            }
        };

        const removePoint = (idx: number) => {
            setPoints(prev => prev.filter((_, i) => i !== idx));
            setPointAccuracies(prev => prev.filter((_, i) => i !== idx));
            setSelectedPointIdx(null);
        };

        const undo = () => {
            setPoints(prev => prev.slice(0, -1));
            setPointAccuracies(prev => prev.slice(0, -1));
            setSelectedPointIdx(null);
        };

        const clear = () => {
            setPoints([]);
            setPointAccuracies([]);
            setSelectedPointIdx(null);
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

        const isActive       = isSampling || isWaitingForLock;
        const isPointsReady  = points.length >= 3;
        const canSavePoints  = locationName.trim().length > 0 && isPointsReady;
        const canSaveGeo     = locationName.trim().length > 0 && circleCenter !== null;

        const pointStatusColor = isPointsReady ? SUCCESS : isActive ? WARNING : '#BCBDC0';
        const pointStatusText  = isActive
            ? isWaitingForLock
                ? retakingIndex !== null
                    ? `Acquiring lock · Point ${retakingIndex + 1}${liveLockAccuracy !== null ? ` · ±${liveLockAccuracy} m` : ''}`
                    : `Acquiring GPS lock${liveLockAccuracy !== null ? ` · ±${liveLockAccuracy} m` : '…'}`
                : retakingIndex !== null
                    ? `Retaking Point ${retakingIndex + 1} · ${samplingStep}/${SAMPLE_COUNT} samples`
                    : `Sampling · ${samplingStep}/${SAMPLE_COUNT}`
            : isPointsReady
                ? `${points.length} point${points.length !== 1 ? 's' : ''} · Boundary ready ✓`
                : `${points.length} point${points.length !== 1 ? 's' : ''} · Need ${Math.max(0, 3 - points.length)} more`;

        const polyCoords = points.map(p => ({ latitude: p.latitude, longitude: p.longitude }));

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

                        {/* Geofence Radius */}
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

                        {/* Drop Points */}
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
                                    Stand at each corner of the venue. The app waits for a strong satellite
                                    lock, collects 12 readings, removes outliers with RANSAC clustering,
                                    then computes a weighted average for maximum precision.
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
                                <Pressable
                                    onPress={fetchCurrentLocation}
                                    disabled={isFetchingLocation}
                                    style={styles.rowCenter}
                                >
                                    {isFetchingLocation ? (
                                        <>
                                            <ActivityIndicator size="small" color={PRIMARY} />
                                            <Text style={[styles.cardTitle, { marginLeft: 12, color: PRIMARY }]}>
                                                Getting location…
                                            </Text>
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
                                : <Text style={[styles.saveBtnText, !canSaveGeo && { color: '#B8BBC6' }]}>
                                    Save Location
                                </Text>}
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
                                onPress={() => setSelectedPointIdx(null)}
                            >
                                {polyCoords.map((coord, i) => (
                                    <Marker
                                        key={i}
                                        coordinate={coord}
                                        anchor={{ x: 0.5, y: 0.65 }}
                                        tracksViewChanges={
                                            draggingIdx === i ||
                                            selectedPointIdx === i ||
                                            (isSampling && retakingIndex === i) ||
                                            pointAccuracies[i] === undefined
                                        }
                                        draggable={!isActive}
                                        onDragStart={() => {
                                            setDraggingIdx(i);
                                            setSelectedPointIdx(null);
                                        }}
                                        onDragEnd={e => {
                                            const { latitude, longitude } = e.nativeEvent.coordinate;
                                            setPoints(prev =>
                                                prev.map((p, idx) => (idx === i ? { latitude, longitude } : p)),
                                            );
                                            // Clear accuracy badge for this point since position changed manually
                                            setPointAccuracies(prev =>
                                                prev.map((a, idx) => (idx === i ? 0 : a)),
                                            );
                                            setDraggingIdx(null);
                                            setSelectedPointIdx(null);
                                        }}
                                        onPress={e => {
                                            e.stopPropagation();
                                            if (!isActive) {
                                                setSelectedPointIdx(prev => (prev === i ? null : i));
                                            }
                                        }}
                                    >
                                        <View style={styles.markerContainer}>
                                            <View
                                                style={[
                                                    styles.vertex,
                                                    { backgroundColor: POINT_COLORS[i % POINT_COLORS.length] },
                                                    selectedPointIdx === i && styles.vertexSelected,
                                                    draggingIdx === i && styles.vertexDragging,
                                                    isActive && retakingIndex === i && styles.vertexRetaking,
                                                ]}
                                            >
                                                <Text style={styles.vertexText}>{i + 1}</Text>
                                            </View>
                                            {pointAccuracies[i] !== undefined && (
                                                <View style={[
                                                    styles.accuracyBadge,
                                                    { backgroundColor: getAccuracyColor(pointAccuracies[i]) },
                                                ]}>
                                                    <Text style={styles.accuracyBadgeText}>
                                                        ±{pointAccuracies[i] < 10
                                                            ? pointAccuracies[i].toFixed(1)
                                                            : Math.round(pointAccuracies[i])}m
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </Marker>
                                ))}

                                {polyCoords.length >= 2 && (
                                    <Polyline
                                        coordinates={polyCoords}
                                        strokeColor="rgba(99,67,204,0.9)"
                                        strokeWidth={2}
                                        lineDashPattern={[8, 4]}
                                    />
                                )}

                                {polyCoords.length >= 3 && (
                                    <Polygon
                                        coordinates={polyCoords}
                                        fillColor="rgba(99,67,204,0.10)"
                                        strokeColor="rgba(99,67,204,0.85)"
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

                            {/* ── GPS lock-wait banner with live signal meter ── */}
                            {isWaitingForLock && (
                                <View style={[styles.hintBanner, styles.hintBannerTall, { backgroundColor: 'rgba(0,0,0,0.88)' }]}>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={[styles.hintText, { marginTop: 8, fontWeight: '600' }]}>
                                        {retakingIndex !== null
                                            ? `Stabilising GPS · Point ${retakingIndex + 1}`
                                            : 'Stabilising GPS signal…'}
                                    </Text>
                                    {liveLockAccuracy !== null && (
                                        <Text style={[styles.hintText, { opacity: 0.8, marginTop: 2 }]}>
                                            Current accuracy: ±{liveLockAccuracy} m
                                            {liveLockAccuracy <= LOCK_TARGET_M ? '  ✓ Locked' : ''}
                                        </Text>
                                    )}

                                    {/* Signal bar visualisation */}
                                    <View style={styles.signalBars}>
                                        {[1, 2, 3, 4, 5].map(bar => {
                                            const filled = bar <= signalLevel(liveLockAccuracy);
                                            return (
                                                <View
                                                    key={bar}
                                                    style={[
                                                        styles.signalBar,
                                                        { height: 6 + bar * 4 },
                                                        filled
                                                            ? { backgroundColor: SUCCESS }
                                                            : { backgroundColor: 'rgba(255,255,255,0.18)' },
                                                    ]}
                                                />
                                            );
                                        })}
                                    </View>

                                    <Text style={[styles.hintText, { opacity: 0.5, fontSize: 11, marginTop: 6 }]}>
                                        Hold still · Waiting for ≤{LOCK_TARGET_M} m satellite lock
                                    </Text>
                                </View>
                            )}

                            {/* ── Sampling progress banner ── */}
                            {isSampling && !isWaitingForLock && (
                                <View style={[styles.hintBanner, styles.hintBannerTall, { backgroundColor: 'rgba(0,0,0,0.80)' }]}>
                                    <Text style={[styles.hintText, { fontWeight: '600' }]}>
                                        {retakingIndex !== null
                                            ? `Hold still · Retaking Point ${retakingIndex + 1} · ${samplingStep} of ${SAMPLE_COUNT}`
                                            : `Hold still · Reading ${samplingStep} of ${SAMPLE_COUNT}`}
                                    </Text>
                                    <View style={styles.progressTrack}>
                                        {Array.from({ length: SAMPLE_COUNT }, (_, idx) => idx + 1).map(step => (
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
                                    <Text style={[styles.hintText, { opacity: 0.55, fontSize: 11, marginTop: 4 }]}>
                                        Collecting {SAMPLE_COUNT} readings · Outlier rejection in progress
                                    </Text>
                                </View>
                            )}

                            {/* ── Point action card (tap a marker to reveal) ── */}
                            {!isActive && selectedPointIdx !== null && draggingIdx === null && (
                                <View style={styles.pointActionCard}>
                                    <View style={styles.pointActionHeader}>
                                        <View style={[
                                            styles.pointActionDot,
                                            { backgroundColor: POINT_COLORS[selectedPointIdx % POINT_COLORS.length] },
                                        ]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.pointActionTitle}>
                                                Point {selectedPointIdx + 1}
                                            </Text>
                                            {pointAccuracies[selectedPointIdx] !== undefined && (
                                                <Text style={[
                                                    styles.pointActionAccuracy,
                                                    { color: getAccuracyColor(pointAccuracies[selectedPointIdx]) },
                                                ]}>
                                                    ±{pointAccuracies[selectedPointIdx] < 10
                                                        ? pointAccuracies[selectedPointIdx].toFixed(1)
                                                        : Math.round(pointAccuracies[selectedPointIdx])}m accuracy
                                                </Text>
                                            )}
                                        </View>
                                        <Pressable
                                            onPress={() => setSelectedPointIdx(null)}
                                            style={styles.pointActionClose}
                                        >
                                            <Ionicons name="close" size={16} color="#8F94A4" />
                                        </Pressable>
                                    </View>
                                    <Text style={styles.pointActionHint}>
                                        Drag the pin to fine-tune its position, or use the options below.
                                    </Text>
                                    <View style={styles.pointActionBtns}>
                                        <Pressable
                                            onPress={() => dropPoint(selectedPointIdx)}
                                            style={[
                                                styles.pointActionBtn,
                                                { backgroundColor: POINT_COLORS[selectedPointIdx % POINT_COLORS.length] },
                                            ]}
                                        >
                                            <Ionicons name="refresh-circle" size={16} color="#fff" />
                                            <Text style={styles.pointActionBtnText}>Retake GPS</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => removePoint(selectedPointIdx)}
                                            style={[styles.pointActionBtn, { backgroundColor: DANGER }]}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#fff" />
                                            <Text style={styles.pointActionBtnText}>Remove</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            )}

                            {/* ── Idle instruction banners ── */}
                            {!isActive && selectedPointIdx === null && !isPointsReady && (
                                <View style={[styles.hintBanner, { backgroundColor: 'rgba(0,0,0,0.60)' }]}>
                                    <Ionicons name="location" size={14} color="#fff" />
                                    <Text style={styles.hintText}>
                                        Stand at each corner of the venue and press Drop Point
                                    </Text>
                                </View>
                            )}
                            {!isActive && selectedPointIdx === null && isPointsReady && (
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
                                        onPress={() => dropPoint()}
                                        disabled={isActive}
                                        style={[
                                            styles.walkBtn,
                                            isActive ? { backgroundColor: WARNING } : { backgroundColor: SUCCESS },
                                        ]}
                                    >
                                        <Ionicons name="location" size={18} color="#fff" />
                                        <Text style={styles.walkBtnText}>
                                            {isActive
                                                ? isWaitingForLock
                                                    ? 'Locking GPS…'
                                                    : `Reading ${samplingStep}/${SAMPLE_COUNT}…`
                                                : `Drop Point${points.length > 0 ? ` (${points.length})` : ''}`}
                                        </Text>
                                    </Pressable>
                                </Animated.View>

                                <View style={styles.walkIconGroup}>
                                    <Pressable
                                        onPress={undo}
                                        disabled={points.length === 0 || isActive}
                                        style={[
                                            styles.mapIconBtn,
                                            (points.length === 0 || isActive) && styles.mapIconBtnOff,
                                        ]}
                                    >
                                        <Ionicons
                                            name="arrow-undo"
                                            size={18}
                                            color={points.length > 0 && !isActive ? '#FF9800' : '#B0BEC5'}
                                        />
                                    </Pressable>
                                    <Pressable
                                        onPress={clear}
                                        disabled={points.length === 0 || isActive}
                                        style={[
                                            styles.mapIconBtn,
                                            (points.length === 0 || isActive) && styles.mapIconBtnOff,
                                        ]}
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={18}
                                            color={points.length > 0 && !isActive ? DANGER : '#B0BEC5'}
                                        />
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

                        {/* Bottom panel — always visible at 96% height */}
                        <View style={[styles.lightPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                            <View style={styles.lightInputRow}>
                                <Ionicons
                                    name="pricetag-outline"
                                    size={16}
                                    color="#8F94A4"
                                    style={{ marginRight: 8 }}
                                />
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
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={18}
                                            color={canSavePoints ? '#fff' : '#B8BBC6'}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text style={[styles.saveBtnText, !canSavePoints && { color: '#B8BBC6' }]}>
                                            Save Boundary
                                        </Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    background:    { backgroundColor: BG, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    handle:        { width: 88, height: 4, borderRadius: 3, backgroundColor: '#BCBDC0', alignSelf: 'center' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },

    row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    title:     { fontFamily: 'WorkSans_600SemiBold', fontSize: 20, color: '#181A20' },
    subtitle:  { fontFamily: 'WorkSans_400Regular',  fontSize: 13, color: '#8F94A4', marginTop: 2 },
    closeBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
    backBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14, marginBottom: 20 },
    infoIcon:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFE082', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    infoTitle:  { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#E65100', marginBottom: 3 },
    infoText:   { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#FF8F00', lineHeight: 18 },

    pickerPrompt: { fontFamily: 'WorkSans_400Regular', fontSize: 13, color: '#8F94A4', lineHeight: 20, marginBottom: 20, marginTop: -8 },

    bigCard:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EAF1', borderRadius: 20, marginBottom: 14, overflow: 'hidden' },
    bigCardPressed:  { borderColor: PRIMARY, backgroundColor: '#FAFAFE' },
    bigCardBand:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
    bigCardIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
    bigCardBadge:    { backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    bigCardBadgeText:{ fontFamily: 'WorkSans_600SemiBold', fontSize: 11, color: PRIMARY, letterSpacing: 0.3 },
    bigCardBody:     { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
    bigCardTitle:    { fontFamily: 'WorkSans_700Bold', fontSize: 17, color: '#181A20', marginBottom: 6 },
    bigCardDesc:     { fontFamily: 'WorkSans_400Regular', fontSize: 13, color: '#5A5D6B', lineHeight: 20, marginBottom: 12 },
    bigCardTags:     { flexDirection: 'row', gap: 8 },
    bigCardTag:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    bigCardTagText:  { fontFamily: 'WorkSans_500Medium', fontSize: 11 },
    bigCardArrow:    { position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },

    label:      { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#5A5D6B', marginBottom: 8 },
    inputWrap:  { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1', paddingHorizontal: 14, gap: 10 },
    textInput:  { flex: 1, fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#181A20' },
    card:       { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1', borderRadius: 16, padding: 16 },
    cardTitle:  { fontFamily: 'WorkSans_500Medium', fontSize: 14, color: '#181A20' },
    cardSub:    { fontFamily: 'WorkSans_400Regular', fontSize: 11, color: '#8F94A4', marginTop: 2 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    radiusRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
    radiusChip:     { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1' },
    radiusChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    radiusChipText: { fontFamily: 'WorkSans_500Medium', fontSize: 13, color: '#5A5D6B' },
    radiusHint:     { fontFamily: 'WorkSans_400Regular', fontSize: 11, color: '#8F94A4', textAlign: 'center' },

    saveBtn:     { height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    saveBtnOn:   { backgroundColor: PRIMARY },
    saveBtnOff:  { backgroundColor: '#EDEDF3' },
    saveBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 16, color: '#fff' },

    mapShell: { flex: 1 },
    mapArea:  { flex: 1, overflow: 'hidden' },

    mapHeader:      { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    mapNavBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    mapHeaderTitle: { fontFamily: 'WorkSans_600SemiBold', fontSize: 15, color: '#fff' },
    mapHeaderSub:   { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

    statusPill: { position: 'absolute', top: 78, left: 40, right: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    statusDot:  { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
    statusText: { fontFamily: 'WorkSans_500Medium', fontSize: 12, color: '#fff' },

    hintBanner:         { position: 'absolute', top: 128, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
    hintBannerTall:     { flexDirection: 'column', paddingVertical: 16 },
    hintText:           { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#fff', marginLeft: 6, textAlign: 'center' },
    progressTrack:      { flexDirection: 'row', gap: 5, marginTop: 10, width: '85%' },
    progressSegment:    { height: 5, flex: 1, borderRadius: 3 },
    progressSegmentDone:{ backgroundColor: SUCCESS },
    progressSegmentPending: { backgroundColor: 'rgba(255,255,255,0.22)' },

    // GPS signal-strength bar chart shown during lock wait
    signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 10, height: 30 },
    signalBar:  { width: 10, borderRadius: 3 },

    // Point action card
    pointActionCard: {
        position: 'absolute',
        bottom: 80,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    pointActionHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    pointActionDot:      { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
    pointActionTitle:    { fontFamily: 'WorkSans_600SemiBold', fontSize: 15, color: '#181A20' },
    pointActionAccuracy: { fontFamily: 'WorkSans_500Medium', fontSize: 11, marginTop: 1 },
    pointActionClose:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
    pointActionHint:     { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#8F94A4', marginBottom: 12, marginTop: 4 },
    pointActionBtns:     { flexDirection: 'row', gap: 10 },
    pointActionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12 },
    pointActionBtnText:  { fontFamily: 'WorkSans_600SemiBold', fontSize: 13, color: '#fff' },

    walkControls:  { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    walkBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    walkBtnText:   { fontFamily: 'WorkSans_600SemiBold', fontSize: 14, color: '#fff' },
    walkIconGroup: { flexDirection: 'row', gap: 8 },
    mapIconBtn:    { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
    mapIconBtnOff: { backgroundColor: 'rgba(255,255,255,0.45)' },

    // Marker
    markerContainer:  { alignItems: 'center' },
    vertex:           { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
    vertexSelected:   { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: '#fff' },
    vertexDragging:   { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#fff', opacity: 0.85, shadowOpacity: 0.5, shadowRadius: 10, elevation: 12 },
    vertexRetaking:   { opacity: 0.45 },
    vertexText:       { color: '#fff', fontWeight: '800', fontSize: 12 },
    accuracyBadge:    { marginTop: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: 'center' },
    accuracyBadgeText:{ color: '#fff', fontWeight: '700', fontSize: 9 },

    lightPanel:     { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EAF1', paddingHorizontal: 16, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: -3 }, shadowRadius: 10, elevation: 10 },
    lightInputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 10 },
    lightTextInput: { flex: 1, fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#181A20' },
});
