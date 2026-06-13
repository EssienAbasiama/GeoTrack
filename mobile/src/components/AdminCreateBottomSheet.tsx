import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { courseApi, geofenceApi, institutionApi } from '../services/apiClient';
import { useAuth } from '../store/AuthContext';
import type { ApiInstitution } from '../types/api';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetScrollView,
    type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
    SetBoundaryBottomSheet,
    type SetBoundaryBottomSheetRef,
    type ClassBoundary,
} from './SetBoundaryBottomSheet';

const PRIMARY_COLOR = '#6343cc';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00',
];

// select → (institution for superadmin) → class → submit
// Venue is picked inline via 'venue' mode; GPS boundary stacks on top as a second sheet
type CreateMode = 'select' | 'institution' | 'class' | 'venue' | 'lecturer';
type PickerType = 'day' | 'startTime' | 'endTime' | null;

export interface AdminCreateBottomSheetRef {
    open: (initialMode?: 'select' | 'class' | 'lecturer') => void;
    close: () => void;
}

interface AdminCreateBottomSheetProps {
    onClose?: () => void;
    onSuccess?: () => void;
}

export const AdminCreateBottomSheet = forwardRef<AdminCreateBottomSheetRef, AdminCreateBottomSheetProps>(
    ({ onClose, onSuccess }, ref) => {
        const bottomSheetRef  = useRef<BottomSheetModal>(null);
        const setBoundaryRef  = useRef<SetBoundaryBottomSheetRef>(null);
        const insets          = useSafeAreaInsets();
        const { user }        = useAuth();
        const isSuperAdmin    = user?.role === 'superadmin';

        const [mode,       setMode]       = useState<CreateMode>('select');
        const [submitting, setSubmitting] = useState(false);

        // ── Institution picker (superadmin only) ─────────────────────────────
        const [institutions,        setInstitutions]        = useState<ApiInstitution[]>([]);
        const [institutionsLoading, setInstitutionsLoading] = useState(false);
        const [institutionSearch,   setInstitutionSearch]   = useState('');
        const [selectedInstitution, setSelectedInstitution] = useState<ApiInstitution | null>(null);

        // ── Venue picker ─────────────────────────────────────────────────────
        const [courseVenues,   setCourseVenues]   = useState<string[]>([]);
        const [venuesLoading,  setVenuesLoading]  = useState(false);
        const [venueSearch,    setVenueSearch]    = useState('');
        const [customBoundary, setCustomBoundary] = useState<ClassBoundary | null>(null);

        // ── Class form ───────────────────────────────────────────────────────
        const [classCode,  setClassCode]  = useState('');
        const [className,  setClassName]  = useState('');
        const [venue,      setVenue]      = useState('');
        const [day,        setDay]        = useState('');
        const [startTime,  setStartTime]  = useState('');
        const [endTime,    setEndTime]    = useState('');

        // ── Lecturer form ────────────────────────────────────────────────────
        const [lecturerName,  setLecturerName]  = useState('');
        const [lecturerEmail, setLecturerEmail] = useState('');
        const [department,    setDepartment]    = useState('');

        const [activePicker, setActivePicker] = useState<PickerType>(null);

        const snapPoints = useMemo(() => ['85%'], []);

        // ── Fetch institutions for the institution-picker step ─────────────
        useEffect(() => {
            if (mode !== 'institution') return;
            setInstitutionsLoading(true);
            institutionApi.list()
                .then(({ data }) => setInstitutions(data.institutions))
                .catch(() => Toast.show({ type: 'error', text1: 'Could not load institutions.', position: 'bottom' }))
                .finally(() => setInstitutionsLoading(false));
        }, [mode]);

        // ── Fetch unique venue names for the venue-picker step ──────────────
        useEffect(() => {
            if (mode !== 'venue') return;
            setVenuesLoading(true);
            courseApi.list()
                .then(({ data }) => {
                    const instId = isSuperAdmin
                        ? selectedInstitution?.id
                        : user?.institutionId ?? undefined;
                    const all = data.courses;
                    const venues = all
                        .filter(c => !instId || c.institution_id === instId)
                        .map(c => c.venue?.trim())
                        .filter((v): v is string => Boolean(v))
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .sort();
                    setCourseVenues(venues);
                })
                .catch(() => Toast.show({ type: 'error', text1: 'Could not load venues.', position: 'bottom' }))
                .finally(() => setVenuesLoading(false));
        }, [mode]);

        const filteredInstitutions = useMemo(() => {
            const q = institutionSearch.trim().toLowerCase();
            if (!q) return institutions;
            return institutions.filter(
                i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
            );
        }, [institutions, institutionSearch]);

        const filteredVenues = useMemo(() => {
            const q = venueSearch.trim().toLowerCase();
            if (!q) return courseVenues;
            return courseVenues.filter(v => v.toLowerCase().includes(q));
        }, [courseVenues, venueSearch]);

        // ── Venue display label shown in the class form field ───────────────
        const venueLabel = useMemo(() => {
            if (customBoundary) {
                const pts = customBoundary.polygonCoords?.length ?? 0;
                return pts >= 3
                    ? `GPS boundary — ${pts} points`
                    : `GPS boundary — ${customBoundary.name}`;
            }
            return venue;
        }, [venue, customBoundary]);

        const resetForm = () => {
            setClassCode(''); setClassName(''); setVenue('');
            setDay(''); setStartTime(''); setEndTime('');
            setLecturerName(''); setLecturerEmail(''); setDepartment('');
            setSelectedInstitution(null); setInstitutionSearch('');
            setCourseVenues([]); setVenueSearch('');
            setCustomBoundary(null);
        };

        useImperativeHandle(ref, () => ({
            open: (initialMode?: 'select' | 'class' | 'lecturer') => {
                resetForm();
                setMode(initialMode || 'select');
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const handleSheetChange = useCallback(
            (index: number) => { if (index === -1) { setMode('select'); onClose?.(); } },
            [onClose],
        );

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
            ),
            [],
        );

        // ── Navigation helpers ───────────────────────────────────────────────
        const handleGoToClass = () => {
            Keyboard.dismiss();
            if (isSuperAdmin) { setMode('institution'); } else { setMode('class'); }
        };

        const handleInstitutionConfirmed = () => {
            if (!selectedInstitution) {
                Toast.show({ type: 'error', text1: 'Please select an institution.', position: 'bottom' });
                return;
            }
            setMode('class');
        };

        // ── GPS boundary from venue picker ───────────────────────────────────
        const handleDrawGPSBoundary = () => {
            // Go back to class form so it's visible behind the boundary sheet
            setMode('class');
            // Small delay to let the class-form snap into position first
            setTimeout(() => setBoundaryRef.current?.open(), 100);
        };

        const handleBoundarySaved = useCallback((boundary: ClassBoundary) => {
            setCustomBoundary(boundary);
            // SetBoundaryBottomSheet dismisses itself after calling this callback;
            // the admin sheet reappears automatically.
        }, []);

        // ── Submit ────────────────────────────────────────────────────────────
        const handleFinishCreateClass = async () => {
            if (!classCode.trim() || !className.trim()) {
                Toast.show({ type: 'error', text1: 'Class code and name are required.', position: 'bottom' });
                return;
            }
            Keyboard.dismiss();
            setSubmitting(true);
            try {
                const { data: created } = await courseApi.create({
                    code:           classCode.trim(),
                    title:          className.trim(),
                    venue:          venue.trim() || undefined,
                    day:            day || undefined,
                    start_time:     startTime || undefined,
                    end_time:       endTime || undefined,
                    institution_id: isSuperAdmin ? selectedInstitution?.id : undefined,
                });

                // If user drew a custom GPS boundary, persist it now that we have the course ID
                if (customBoundary) {
                    const courseId = (created as any).course?.id;
                    if (courseId) {
                        const polygon = customBoundary.polygonCoords;
                        await geofenceApi.upsert(courseId, {
                            shape:      polygon && polygon.length >= 3 ? 'polygon' : 'circle',
                            center_lat: customBoundary.latitude,
                            center_lng: customBoundary.longitude,
                            radius_m:   customBoundary.radius ?? 50,
                            polygon:    polygon ?? undefined,
                            label:      customBoundary.name || className.trim(),
                        });
                    }
                }

                Toast.show({ type: 'success', text1: 'Class created successfully.', position: 'bottom' });
                resetForm();
                setMode('select');
                bottomSheetRef.current?.dismiss();
                onSuccess?.();
            } catch (err) {
                const msg = (err as any)?.response?.data?.message ?? 'Could not create class. Please try again.';
                Toast.show({ type: 'error', text1: msg, position: 'bottom' });
            } finally {
                setSubmitting(false);
            }
        };

        const handleCreateLecturer = () => {
            setLecturerName(''); setLecturerEmail(''); setDepartment('');
            bottomSheetRef.current?.dismiss();
        };

        // ── Institution banner ────────────────────────────────────────────────
        const institutionBanner = () => {
            const inst = isSuperAdmin ? selectedInstitution : user?.institution ?? null;
            if (!inst) return null;
            return (
                <View style={styles.institutionBanner}>
                    <Ionicons name="business" size={14} color={PRIMARY_COLOR} style={{ marginRight: 6 }} />
                    <Text style={styles.institutionBannerText} numberOfLines={1}>
                        {inst.name}
                        <Text style={{ color: '#A89BD6' }}>  ·  {inst.code}</Text>
                    </Text>
                </View>
            );
        };

        // ═══════════════════════════════════════════════════════════════════
        // RENDER MODES
        // ═══════════════════════════════════════════════════════════════════

        const renderSelectMode = () => (
            <View style={styles.contentWrapper}>
                <Text className="font-heading text-[24px] text-[#181A20] text-center mb-2">Create New</Text>
                <Text className="text-[14px] text-[#8F94A4] text-center mb-8">What would you like to create?</Text>

                <Pressable onPress={handleGoToClass} className="mb-4 rounded-[20px] border-2 border-[#E8EAF1] bg-white p-5 active:bg-[#F5F6FA]">
                    <View className="flex-row items-center">
                        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-[#F0EDFC]">
                            <Ionicons name="book" size={26} color={PRIMARY_COLOR} />
                        </View>
                        <View className="ml-4 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Create Class</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">Add a new class to the system</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#8F94A4" />
                    </View>
                </Pressable>

                <Pressable onPress={() => setMode('lecturer')} className="mb-4 rounded-[20px] border-2 border-[#E8EAF1] bg-white p-5 active:bg-[#F5F6FA]">
                    <View className="flex-row items-center">
                        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-[#E8F5E9]">
                            <Ionicons name="person-add" size={26} color="#4CAF50" />
                        </View>
                        <View className="ml-4 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Create Lecturer</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">Add a new lecturer to the system</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#8F94A4" />
                    </View>
                </Pressable>

                <Pressable className="rounded-[20px] border-2 border-[#E8EAF1] bg-white p-5 active:bg-[#F5F6FA]">
                    <View className="flex-row items-center">
                        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-[#FFF3E0]">
                            <MaterialCommunityIcons name="link-variant" size={26} color="#FF9800" />
                        </View>
                        <View className="ml-4 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Assign Lecturer</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">Assign a lecturer to a class</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#8F94A4" />
                    </View>
                </Pressable>
            </View>
        );

        const renderInstitutionPicker = () => (
            <View style={[styles.contentWrapper, { flex: 1 }]}>
                <View className="flex-row items-center mb-5">
                    <Pressable onPress={() => setMode('select')} className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3">
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <View className="flex-1">
                        <Text className="font-heading text-[20px] text-[#181A20]">Select Institution</Text>
                        <Text className="text-[12px] text-[#8F94A4] mt-0.5">The class will belong to this institution</Text>
                    </View>
                </View>

                <View className="flex-row items-center bg-white rounded-[14px] border border-[#E8EAF1] px-4 h-12 mb-3">
                    <Ionicons name="search" size={16} color="#8F94A4" style={{ marginRight: 8 }} />
                    <TextInput
                        value={institutionSearch}
                        onChangeText={setInstitutionSearch}
                        placeholder="Search by name or code…"
                        placeholderTextColor="#B8BBC6"
                        style={{ flex: 1, fontSize: 14, color: '#181A20', fontFamily: 'WorkSans_400Regular' }}
                    />
                    {institutionSearch.length > 0 && (
                        <Pressable onPress={() => setInstitutionSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#B8BBC6" />
                        </Pressable>
                    )}
                </View>

                {institutionsLoading ? (
                    <View className="flex-1 items-center justify-center py-8">
                        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
                        {filteredInstitutions.length === 0 ? (
                            <View className="items-center py-10">
                                <Ionicons name="business-outline" size={36} color="#D1D5DB" />
                                <Text className="mt-2 text-[13px] text-[#8F94A4] text-center">
                                    {institutionSearch ? 'No match found.' : 'No institutions yet.'}
                                </Text>
                            </View>
                        ) : filteredInstitutions.map(inst => {
                            const isSelected = selectedInstitution?.id === inst.id;
                            return (
                                <Pressable
                                    key={inst.id}
                                    onPress={() => setSelectedInstitution(inst)}
                                    className="mb-2 rounded-[14px] border-2 bg-white p-4 flex-row items-center"
                                    style={{ borderColor: isSelected ? PRIMARY_COLOR : '#E8EAF1' }}
                                >
                                    <View className="h-10 w-10 rounded-[10px] items-center justify-center mr-3" style={{ backgroundColor: isSelected ? '#F0EDFC' : '#F5F6FA' }}>
                                        <Ionicons name="business" size={20} color={isSelected ? PRIMARY_COLOR : '#8F94A4'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[14px]" style={{ color: isSelected ? PRIMARY_COLOR : '#181A20', fontFamily: 'WorkSans_500Medium' }}>
                                            {inst.name}
                                        </Text>
                                        {inst.address ? <Text className="text-[11px] text-[#8F94A4] mt-0.5">{inst.address}</Text> : null}
                                        <View className="mt-1 self-start bg-[#F1F2F6] rounded-full px-2 py-0.5">
                                            <Text className="text-[10px] text-[#5A5D6B]">{inst.code}</Text>
                                        </View>
                                    </View>
                                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={PRIMARY_COLOR} />}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                )}

                <Pressable
                    onPress={handleInstitutionConfirmed}
                    disabled={!selectedInstitution}
                    className="mt-4 h-14 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: selectedInstitution ? PRIMARY_COLOR : '#E8EAF1' }}
                >
                    <Text style={{ fontFamily: 'WorkSans_600SemiBold', color: selectedInstitution ? '#fff' : '#B8BBC6', fontSize: 15 }}>
                        {selectedInstitution ? `Continue with ${selectedInstitution.name}` : 'Select an institution'}
                    </Text>
                </Pressable>
            </View>
        );

        const renderClassForm = () => (
            <View style={styles.contentWrapper}>
                <View className="flex-row items-center mb-4">
                    <Pressable
                        onPress={() => isSuperAdmin ? setMode('institution') : setMode('select')}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3"
                    >
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Create Class</Text>
                </View>

                {institutionBanner()}

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Class Code *</Text>
                    <TextInput
                        value={classCode}
                        onChangeText={setClassCode}
                        placeholder="e.g., ELE 512"
                        placeholderTextColor="#B8BBC6"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Class Name *</Text>
                    <TextInput
                        value={className}
                        onChangeText={setClassName}
                        placeholder="e.g., Digital Signal Processing"
                        placeholderTextColor="#B8BBC6"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                {/* Venue — tapping opens the venue picker step */}
                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Venue / Location</Text>
                    <Pressable
                        onPress={() => setMode('venue')}
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center"
                        style={venueLabel ? styles.venueFieldFilled : undefined}
                    >
                        <Ionicons
                            name={customBoundary ? 'location' : 'location-outline'}
                            size={18}
                            color={venueLabel ? PRIMARY_COLOR : '#B8BBC6'}
                            style={{ marginRight: 8 }}
                        />
                        <Text
                            numberOfLines={1}
                            style={{
                                flex: 1,
                                fontSize: 15,
                                fontFamily: 'WorkSans_400Regular',
                                color: venueLabel ? '#181A20' : '#B8BBC6',
                            }}
                        >
                            {venueLabel || 'Select or create a location…'}
                        </Text>
                        {venueLabel ? (
                            <Pressable
                                hitSlop={8}
                                onPress={(e) => { e.stopPropagation(); setVenue(''); setCustomBoundary(null); }}
                            >
                                <Ionicons name="close-circle" size={18} color="#B8BBC6" />
                            </Pressable>
                        ) : (
                            <Ionicons name="chevron-forward" size={18} color="#B8BBC6" />
                        )}
                    </Pressable>
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Day</Text>
                    <Pressable
                        onPress={() => setActivePicker('day')}
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center justify-between"
                    >
                        <Text className={day ? 'text-[15px] text-[#181A20]' : 'text-[15px] text-[#B8BBC6]'}>
                            {day || 'Select a day'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#8F94A4" />
                    </Pressable>
                </View>

                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Start Time</Text>
                        <Pressable onPress={() => setActivePicker('startTime')} className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center justify-between">
                            <Text className={startTime ? 'text-[15px] text-[#181A20]' : 'text-[15px] text-[#B8BBC6]'}>
                                {startTime || '09:00'}
                            </Text>
                            <Ionicons name="time-outline" size={20} color="#8F94A4" />
                        </Pressable>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">End Time</Text>
                        <Pressable onPress={() => setActivePicker('endTime')} className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center justify-between">
                            <Text className={endTime ? 'text-[15px] text-[#181A20]' : 'text-[15px] text-[#B8BBC6]'}>
                                {endTime || '11:00'}
                            </Text>
                            <Ionicons name="time-outline" size={20} color="#8F94A4" />
                        </Pressable>
                    </View>
                </View>

                <Pressable
                    onPress={handleFinishCreateClass}
                    disabled={submitting}
                    className="h-14 items-center justify-center rounded-[14px] bg-[#6343cc]"
                    style={{ opacity: submitting ? 0.7 : 1 }}
                >
                    {submitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text className="font-medium text-[16px] text-white">Create Class</Text>
                    }
                </Pressable>
            </View>
        );

        // ── Venue picker step ─────────────────────────────────────────────────
        const renderVenuePicker = () => (
            <View style={[styles.contentWrapper, { flex: 1 }]}>
                <View className="flex-row items-center mb-5">
                    <Pressable onPress={() => setMode('class')} className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3">
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <View className="flex-1">
                        <Text className="font-heading text-[20px] text-[#181A20]">Select Venue</Text>
                        <Text className="text-[12px] text-[#8F94A4] mt-0.5">Pick an existing location or draw a GPS boundary</Text>
                    </View>
                </View>

                {/* Search */}
                <View className="flex-row items-center bg-white rounded-[14px] border border-[#E8EAF1] px-4 h-12 mb-3">
                    <Ionicons name="search" size={16} color="#8F94A4" style={{ marginRight: 8 }} />
                    <TextInput
                        value={venueSearch}
                        onChangeText={setVenueSearch}
                        placeholder="Search venues…"
                        placeholderTextColor="#B8BBC6"
                        style={{ flex: 1, fontSize: 14, color: '#181A20', fontFamily: 'WorkSans_400Regular' }}
                    />
                    {venueSearch.length > 0 && (
                        <Pressable onPress={() => setVenueSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#B8BBC6" />
                        </Pressable>
                    )}
                </View>

                {/* Existing venues list */}
                {venuesLoading ? (
                    <View className="items-center py-8">
                        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 230 }}>
                        {filteredVenues.length === 0 && !venueSearch ? (
                            <View className="items-center py-6">
                                <Ionicons name="location-outline" size={32} color="#D1D5DB" />
                                <Text className="mt-2 text-[13px] text-[#8F94A4] text-center">
                                    No saved venues in this institution yet.
                                </Text>
                            </View>
                        ) : filteredVenues.length === 0 ? (
                            <View className="items-center py-6">
                                <Text className="text-[13px] text-[#8F94A4]">No venues match "{venueSearch}"</Text>
                            </View>
                        ) : filteredVenues.map(v => {
                            const isSelected = !customBoundary && venue === v;
                            return (
                                <Pressable
                                    key={v}
                                    onPress={() => { setVenue(v); setCustomBoundary(null); setMode('class'); }}
                                    className="mb-2 rounded-[14px] border-2 bg-white px-4 h-14 flex-row items-center"
                                    style={{ borderColor: isSelected ? PRIMARY_COLOR : '#E8EAF1' }}
                                >
                                    <View className="h-8 w-8 rounded-[10px] items-center justify-center mr-3" style={{ backgroundColor: isSelected ? '#F0EDFC' : '#F5F6FA' }}>
                                        <Ionicons name="location" size={17} color={isSelected ? PRIMARY_COLOR : '#8F94A4'} />
                                    </View>
                                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: isSelected ? PRIMARY_COLOR : '#181A20', fontFamily: 'WorkSans_500Medium' }}>
                                        {v}
                                    </Text>
                                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={PRIMARY_COLOR} />}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Divider */}
                <View className="flex-row items-center my-3">
                    <View className="flex-1 h-px bg-[#E8EAF1]" />
                    <Text className="mx-3 text-[12px] text-[#B8BBC6]">or</Text>
                    <View className="flex-1 h-px bg-[#E8EAF1]" />
                </View>

                {/* Draw GPS boundary card */}
                <Pressable
                    onPress={handleDrawGPSBoundary}
                    className="rounded-[16px] border-2 p-4 flex-row items-center active:opacity-80"
                    style={{ borderColor: customBoundary ? PRIMARY_COLOR : '#E8EAF1', backgroundColor: customBoundary ? '#F0EDFC' : '#fff' }}
                >
                    <View className="h-12 w-12 rounded-[14px] items-center justify-center mr-4" style={{ backgroundColor: customBoundary ? PRIMARY_COLOR : '#F0EDFC' }}>
                        <Ionicons name="map" size={22} color={customBoundary ? '#fff' : PRIMARY_COLOR} />
                    </View>
                    <View className="flex-1">
                        <Text style={{ fontSize: 15, fontFamily: 'WorkSans_600SemiBold', color: customBoundary ? PRIMARY_COLOR : '#181A20' }}>
                            {customBoundary ? 'GPS Boundary Set ✓' : 'Draw GPS Boundary'}
                        </Text>
                        <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                            {customBoundary
                                ? `${customBoundary.polygonCoords?.length ?? 0} GPS points captured — tap to redraw`
                                : 'Drop GPS points to mark the exact attendance zone'
                            }
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={customBoundary ? PRIMARY_COLOR : '#8F94A4'} />
                </Pressable>
            </View>
        );

        const renderLecturerForm = () => (
            <View style={styles.contentWrapper}>
                <View className="flex-row items-center mb-4">
                    <Pressable onPress={() => setMode('select')} className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3">
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Create Lecturer</Text>
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Full Name *</Text>
                    <TextInput value={lecturerName} onChangeText={setLecturerName} placeholder="e.g., Dr. Adewale Johnson" placeholderTextColor="#B8BBC6" className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]" />
                </View>
                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Email Address *</Text>
                    <TextInput value={lecturerEmail} onChangeText={setLecturerEmail} placeholder="e.g., a.johnson@university.edu" placeholderTextColor="#B8BBC6" keyboardType="email-address" autoCapitalize="none" className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]" />
                </View>
                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Department *</Text>
                    <TextInput value={department} onChangeText={setDepartment} placeholder="e.g., Electrical Engineering" placeholderTextColor="#B8BBC6" className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]" />
                </View>

                <Pressable onPress={handleCreateLecturer} className="mt-4 h-14 items-center justify-center rounded-[14px] bg-[#4CAF50]">
                    <Text className="font-medium text-[16px] text-white">Create Lecturer</Text>
                </Pressable>
            </View>
        );

        // ── Day / Time picker modal ───────────────────────────────────────────
        const getPickerTitle   = () => activePicker === 'day' ? 'Select Day' : activePicker === 'startTime' ? 'Select Start Time' : 'Select End Time';
        const getPickerOptions = () => activePicker === 'day' ? DAYS_OF_WEEK : TIME_OPTIONS;
        const getSelectedValue = () => activePicker === 'day' ? day : activePicker === 'startTime' ? startTime : endTime;
        const handlePickerSelect = (value: string) => {
            if (activePicker === 'day') setDay(value);
            else if (activePicker === 'startTime') setStartTime(value);
            else setEndTime(value);
            setActivePicker(null);
        };

        const renderPickerModal = () => (
            <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={() => setActivePicker(null)}>
                <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setActivePicker(null)}>
                    <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-[28px]" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
                        <View className="items-center py-3">
                            <View className="h-[5px] w-14 rounded-full bg-[#D7DBE6]" />
                        </View>
                        <View className="flex-row items-center justify-between px-5 pb-4">
                            <Text className="font-heading text-[20px] text-[#181A20]">{getPickerTitle()}</Text>
                            <Pressable onPress={() => setActivePicker(null)} className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]">
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>
                        <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                            {getPickerOptions().map(option => {
                                const isSelected = option === getSelectedValue();
                                return (
                                    <Pressable
                                        key={option}
                                        onPress={() => handlePickerSelect(option)}
                                        className={`h-14 rounded-[14px] mb-2 px-4 flex-row items-center justify-between ${isSelected ? 'bg-[#F0EDFC] border-2 border-[#6343cc]' : 'bg-[#F5F6FA]'}`}
                                    >
                                        <Text className={`text-[16px] ${isSelected ? 'font-medium text-[#6343cc]' : 'text-[#181A20]'}`}>{option}</Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={PRIMARY_COLOR} />}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        );

        return (
            <>
                <BottomSheetModal
                    ref={bottomSheetRef}
                    snapPoints={snapPoints}
                    backdropComponent={renderBackdrop}
                    enablePanDownToClose
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    onChange={handleSheetChange}
                    handleIndicatorStyle={styles.handleIndicator}
                    backgroundStyle={styles.background}
                >
                    <BottomSheetScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}
                    >
                        {mode === 'select'      && renderSelectMode()}
                        {mode === 'institution' && renderInstitutionPicker()}
                        {mode === 'class'       && renderClassForm()}
                        {mode === 'venue'       && renderVenuePicker()}
                        {mode === 'lecturer'    && renderLecturerForm()}
                    </BottomSheetScrollView>
                </BottomSheetModal>

                {/* GPS boundary sheet — stacks on top when user taps "Draw GPS Boundary" */}
                <SetBoundaryBottomSheet
                    ref={setBoundaryRef}
                    classCode={classCode || 'New Class'}
                    onSaveLocation={handleBoundarySaved}
                    existingLocation={customBoundary}
                />

                {renderPickerModal()}
            </>
        );
    },
);

AdminCreateBottomSheet.displayName = 'AdminCreateBottomSheet';

const styles = StyleSheet.create({
    background:        { backgroundColor: '#F6F6F9', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    handleIndicator:   { width: 88, height: 4, borderRadius: 3, backgroundColor: '#BCBDC0', alignSelf: 'center' },
    scrollContent:     { paddingTop: 8 },
    contentWrapper:    { paddingHorizontal: 20 },
    institutionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0EDFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    institutionBannerText: {
        fontFamily: 'WorkSans_500Medium',
        fontSize: 13,
        color: PRIMARY_COLOR,
        flex: 1,
    },
    venueFieldFilled: {
        borderColor: PRIMARY_COLOR,
        borderWidth: 1.5,
    },
});
