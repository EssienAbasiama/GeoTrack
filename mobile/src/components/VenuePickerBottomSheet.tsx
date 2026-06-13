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

export interface VenuePickerBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface VenuePickerBottomSheetProps {
    institutionId?: number | null;
    onSelectVenue: (location: ClassBoundary) => void;
    onDrawBoundary: () => void;
}

export const VenuePickerBottomSheet = forwardRef<VenuePickerBottomSheetRef, VenuePickerBottomSheetProps>(
    ({ institutionId, onSelectVenue, onDrawBoundary }, ref) => {
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
                        // Keep only courses with a saved boundary, deduped by venue name.
                        const seen = new Set<string>();
                        const venues = scoped.filter((c) => {
                            if (!hasUsableBoundary(c)) return false;
                            const key = venueNameOf(c).toLowerCase();
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });
                        setCourses(venues);
                    })
                    .catch(() => {
                        Toast.show({ type: 'error', text1: 'Could not load venues.', position: 'bottom' });
                    })
                    .finally(() => setLoading(false));
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const filteredCourses = useMemo(() => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return courses;
            return courses.filter(
                (c) =>
                    venueNameOf(c).toLowerCase().includes(q) ||
                    c.code.toLowerCase().includes(q) ||
                    c.title.toLowerCase().includes(q),
            );
        }, [courses, searchQuery]);

        const handlePickCourse = useCallback(
            (course: ApiCourse) => {
                const fence = course.geofence;
                if (!fence) return;
                const polygon = fence.polygon ?? undefined;
                const hasPolygon = Array.isArray(polygon) && polygon.length >= 3;
                const boundary: ClassBoundary = {
                    latitude: fence.center_lat ?? polygon?.[0]?.latitude ?? 0,
                    longitude: fence.center_lng ?? polygon?.[0]?.longitude ?? 0,
                    radius: fence.radius_m ?? 50,
                    polygonCoords: hasPolygon ? polygon : undefined,
                    name: venueNameOf(course),
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
                        ) : filteredCourses.length > 0 ? (
                            <View>
                                <Text className="text-[12px] text-[#8F94A4] mb-3">
                                    {filteredCourses.length} venue{filteredCourses.length !== 1 ? 's' : ''} found
                                </Text>
                                {filteredCourses.map((course) => {
                                    const isPolygon = (course.geofence?.polygon?.length ?? 0) >= 3;
                                    return (
                                        <Pressable
                                            key={course.id}
                                            onPress={() => handlePickCourse(course)}
                                            className="flex-row items-center p-3 rounded-[14px] bg-white mb-2 border border-[#E8EAF1] active:bg-[#F5F6FA]"
                                        >
                                            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#E8F5E9]">
                                                <Ionicons name={isPolygon ? 'map' : 'location'} size={20} color="#4CAF50" />
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <Text className="font-medium text-[15px] text-[#181A20]" numberOfLines={1}>
                                                    {venueNameOf(course)}
                                                </Text>
                                                <Text className="text-[12px] text-[#8F94A4] mt-0.5" numberOfLines={1}>
                                                    {course.code} • {course.title}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
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
