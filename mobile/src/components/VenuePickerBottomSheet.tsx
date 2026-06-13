import { Ionicons } from '@expo/vector-icons';
import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { courseApi } from '../services/apiClient';
import type { ApiCourse } from '../types/api';
import type { ClassBoundary } from './SetBoundaryBottomSheet';

const PRIMARY_COLOR = '#6343cc';

/** Display name for a venue — prefers the geofence label, then the venue text. */
const venueNameOf = (c: ApiCourse): string =>
    c.geofence?.name?.trim() || c.venue?.trim() || c.code;

/** A course is a reusable "venue" only if it has a saved boundary. */
const hasUsableBoundary = (c: ApiCourse): boolean => {
    const f = c.geofence;
    if (!f) return false;
    return (
        (f.center_lat != null && f.center_lng != null) ||
        (Array.isArray(f.polygon) && f.polygon.length >= 3)
    );
};

/** Minutes since midnight from "HH:MM", "H:MM AM/PM", etc. Null if unparseable. */
const parseTimeToMinutes = (raw?: string | null): number | null => {
    if (!raw) return null;
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3]?.toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
};

/** Half-open interval overlap test. */
const timesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    aStart < bEnd && bStart < aEnd;

interface VenueEntry {
    name: string;
    course: ApiCourse;        // representative course whose geofence we apply
    isPolygon: boolean;
    conflictWith?: string;    // class code already using this venue this period
}

export interface VenuePickerBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface VenuePickerBottomSheetProps {
    institutionId?: number | null;
    /** The class being given a location — excluded from conflict checks. */
    currentClassId?: string | number | null;
    /** Current class schedule, used to flag venues already in use this period. */
    day?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    onSelectVenue: (location: ClassBoundary) => void;
    onDrawBoundary: () => void;
}

export const VenuePickerBottomSheet = forwardRef<VenuePickerBottomSheetRef, VenuePickerBottomSheetProps>(
    ({ institutionId, currentClassId, day, startTime, endTime, onSelectVenue, onDrawBoundary }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();

        const [courses, setCourses] = useState<ApiCourse[]>([]);
        const [loading, setLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');

        const snapPoints = useMemo(() => ['50%', '85%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
                setSearchQuery('');
                setCourses([]);
                bottomSheetRef.current?.present();
                setLoading(true);
                courseApi
                    .list()
                    .then(({ data }) => {
                        const all = data.courses;
                        const scoped = institutionId
                            ? all.filter((c) => c.institution_id === institutionId)
                            : all;
                        // Keep every course with a saved boundary; grouping/dedup
                        // happens in `venueEntries` so we can detect schedule clashes.
                        setCourses(scoped.filter(hasUsableBoundary));
                    })
                    .catch(() => {
                        Toast.show({ type: 'error', text1: 'Could not load venues.', position: 'bottom' });
                    })
                    .finally(() => setLoading(false));
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        // Group courses by venue name, flagging any whose other occupants clash
        // with the current class's day + time slot.
        const venueEntries = useMemo<VenueEntry[]>(() => {
            const curDay = day?.trim().toLowerCase();
            const curStart = parseTimeToMinutes(startTime);
            const curEnd = parseTimeToMinutes(endTime);
            const canCheckClash = Boolean(curDay) && curStart != null && curEnd != null;
            const currentId = currentClassId != null ? String(currentClassId) : null;

            const groups = new Map<string, ApiCourse[]>();
            for (const c of courses) {
                const key = venueNameOf(c).toLowerCase();
                const arr = groups.get(key);
                if (arr) arr.push(c);
                else groups.set(key, [c]);
            }

            const entries: VenueEntry[] = [];
            for (const group of groups.values()) {
                const rep = group[0];
                let conflictWith: string | undefined;

                if (canCheckClash) {
                    for (const c of group) {
                        if (currentId && String(c.id) === currentId) continue;
                        const cDay = c.day?.trim().toLowerCase();
                        const cStart = parseTimeToMinutes(c.start_time);
                        const cEnd = parseTimeToMinutes(c.end_time);
                        if (
                            cDay === curDay &&
                            cStart != null &&
                            cEnd != null &&
                            timesOverlap(curStart!, curEnd!, cStart, cEnd)
                        ) {
                            conflictWith = c.code;
                            break;
                        }
                    }
                }

                entries.push({
                    name: venueNameOf(rep),
                    course: rep,
                    isPolygon: (rep.geofence?.polygon?.length ?? 0) >= 3,
                    conflictWith,
                });
            }

            return entries.sort((a, b) => a.name.localeCompare(b.name));
        }, [courses, day, startTime, endTime, currentClassId]);

        const filteredVenues = useMemo(() => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return venueEntries;
            return venueEntries.filter(
                (v) =>
                    v.name.toLowerCase().includes(q) ||
                    v.course.code.toLowerCase().includes(q) ||
                    v.course.title.toLowerCase().includes(q),
            );
        }, [venueEntries, searchQuery]);

        const handlePickVenue = useCallback(
            (entry: VenueEntry) => {
                if (entry.conflictWith) {
                    Toast.show({
                        type: 'info',
                        text1: `${entry.name} is in use this period`,
                        text2: `Booked by ${entry.conflictWith} at this time.`,
                        position: 'bottom',
                    });
                    return;
                }
                const fence = entry.course.geofence;
                if (!fence) return;
                const polygon = fence.polygon ?? undefined;
                const hasPolygon = Array.isArray(polygon) && polygon.length >= 3;
                const boundary: ClassBoundary = {
                    latitude: fence.center_lat ?? polygon?.[0]?.latitude ?? 0,
                    longitude: fence.center_lng ?? polygon?.[0]?.longitude ?? 0,
                    radius: fence.radius_m ?? 50,
                    polygonCoords: hasPolygon ? polygon : undefined,
                    name: entry.name,
                };
                bottomSheetRef.current?.dismiss();
                onSelectVenue(boundary);
            },
            [onSelectVenue],
        );

        const handleDrawBoundary = useCallback(() => {
            bottomSheetRef.current?.dismiss();
            setTimeout(() => onDrawBoundary(), 150);
        }, [onDrawBoundary]);

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            [],
        );

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                handleIndicatorStyle={styles.handleIndicator}
                backgroundStyle={styles.background}
            >
                <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View>
                            <Text className="font-heading text-[20px] text-[#181A20]">Set Location</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-0.5">
                                Pick a venue or draw your own
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    {/* Draw GPS Boundary */}
                    <Pressable
                        onPress={handleDrawBoundary}
                        className="flex-row items-center p-3 rounded-[14px] bg-[#F0EDFC] mb-4 border border-[#E3DCFA] active:bg-[#E8E2F9]"
                    >
                        <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
                            <Ionicons name="map" size={20} color={PRIMARY_COLOR} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[15px] text-[#181A20]">Draw GPS Boundary</Text>
                            <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                Walk the perimeter or drop points
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={PRIMARY_COLOR} />
                    </Pressable>

                    {/* Search Input */}
                    <View className="flex-row items-center h-[52px] rounded-[14px] bg-white border border-[#E8EAF1] px-4 mb-4">
                        <Ionicons name="search" size={18} color="#8F94A4" />
                        <BottomSheetTextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search venues or class codes..."
                            placeholderTextColor="#B8BBC6"
                            style={styles.searchInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#B8BBC6" />
                            </Pressable>
                        )}
                    </View>

                    {/* Venue list */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                    >
                        {loading ? (
                            <View className="items-center py-8">
                                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                <Text className="text-[13px] text-[#8F94A4] mt-2">Loading venues...</Text>
                            </View>
                        ) : filteredVenues.length > 0 ? (
                            <View>
                                <Text className="text-[12px] text-[#8F94A4] mb-3">
                                    {filteredVenues.length} venue{filteredVenues.length !== 1 ? 's' : ''} found
                                </Text>
                                {filteredVenues.map((entry) => {
                                    const inUse = Boolean(entry.conflictWith);
                                    return (
                                        <Pressable
                                            key={entry.course.id}
                                            onPress={() => handlePickVenue(entry)}
                                            disabled={inUse}
                                            className={
                                                inUse
                                                    ? 'flex-row items-center p-3 rounded-[14px] bg-[#FBFBFC] mb-2 border border-[#EFEFF3]'
                                                    : 'flex-row items-center p-3 rounded-[14px] bg-white mb-2 border border-[#E8EAF1] active:bg-[#F5F6FA]'
                                            }
                                        >
                                            <View
                                                className="h-11 w-11 items-center justify-center rounded-full"
                                                style={{ backgroundColor: inUse ? '#FEECEC' : '#E8F5E9' }}
                                            >
                                                <Ionicons
                                                    name={inUse ? 'lock-closed' : entry.isPolygon ? 'map' : 'location'}
                                                    size={20}
                                                    color={inUse ? '#EF4444' : '#4CAF50'}
                                                />
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <Text
                                                    className="font-medium text-[15px]"
                                                    style={{ color: inUse ? '#A0A3AE' : '#181A20' }}
                                                    numberOfLines={1}
                                                >
                                                    {entry.name}
                                                </Text>
                                                {inUse ? (
                                                    <Text className="text-[12px] text-[#EF4444] mt-0.5" numberOfLines={1}>
                                                        In use this period · {entry.conflictWith}
                                                    </Text>
                                                ) : (
                                                    <Text className="text-[12px] text-[#8F94A4] mt-0.5" numberOfLines={1}>
                                                        {entry.course.code} • {entry.course.title}
                                                    </Text>
                                                )}
                                            </View>
                                            {inUse ? (
                                                <View className="px-2 py-1 rounded-full bg-[#FEECEC]">
                                                    <Text className="text-[10px] font-medium text-[#EF4444]">Busy</Text>
                                                </View>
                                            ) : (
                                                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ) : searchQuery.length > 0 ? (
                            <View className="items-center py-8">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF3E0] mb-3">
                                    <Ionicons name="location-outline" size={28} color="#FF9800" />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No venues found</Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                    Try a different search, or draw{'\n'}a GPS boundary instead
                                </Text>
                            </View>
                        ) : (
                            <View className="items-center py-8">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                    <Ionicons name="location" size={28} color={PRIMARY_COLOR} />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No venues yet</Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                    Draw a GPS boundary above to{'\n'}create the first one
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </BottomSheetView>
            </BottomSheetModal>
        );
    },
);

VenuePickerBottomSheet.displayName = 'VenuePickerBottomSheet';

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
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        color: '#181A20',
    },
});
