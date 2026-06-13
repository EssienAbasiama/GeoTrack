import { Ionicons } from '@expo/vector-icons';
import {
    forwardRef,
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
import { lecturerApi } from '../services/apiClient';
import type { ApiLecturer } from '../types/api';

const PRIMARY_COLOR = '#6343cc';

export interface AssignedLecturer {
    id: number;
    name: string;
    email: string;
}

export interface AssignLecturerBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface AssignLecturerBottomSheetProps {
    courseId: number | string;
    currentLecturerId?: number | null;
    onAssigned: (lecturer: AssignedLecturer) => void;
}

const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const AssignLecturerBottomSheet = forwardRef<AssignLecturerBottomSheetRef, AssignLecturerBottomSheetProps>(
    ({ courseId, currentLecturerId, onAssigned }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();

        const [lecturers, setLecturers] = useState<ApiLecturer[]>([]);
        const [loading, setLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [assigningId, setAssigningId] = useState<number | null>(null);

        const snapPoints = useMemo(() => ['60%', '85%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
                setSearchQuery('');
                setLecturers([]);
                bottomSheetRef.current?.present();
                setLoading(true);
                lecturerApi
                    .list()
                    .then(({ data }) => setLecturers(data.lecturers))
                    .catch(() => {
                        Toast.show({ type: 'error', text1: 'Could not load lecturers.', position: 'bottom' });
                    })
                    .finally(() => setLoading(false));
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const filtered = useMemo(() => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return lecturers;
            return lecturers.filter(
                (l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
            );
        }, [lecturers, searchQuery]);

        const handleAssign = async (lecturer: ApiLecturer) => {
            setAssigningId(lecturer.id);
            try {
                await lecturerApi.assignCourse(lecturer.id, courseId);
                onAssigned({ id: lecturer.id, name: lecturer.name, email: lecturer.email });
                Toast.show({ type: 'success', text1: `${lecturer.name} assigned.`, position: 'bottom' });
                bottomSheetRef.current?.dismiss();
            } catch (err) {
                const msg = (err as any)?.response?.data?.message ?? 'Could not assign lecturer.';
                Toast.show({ type: 'error', text1: msg, position: 'bottom' });
            } finally {
                setAssigningId(null);
            }
        };

        const renderBackdrop = (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
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
                            <Text className="font-heading text-[20px] text-[#181A20]">Assign Lecturer</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-0.5">Choose a lecturer for this class</Text>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    {/* Search */}
                    <View className="flex-row items-center h-[52px] rounded-[14px] bg-white border border-[#E8EAF1] px-4 mb-4">
                        <Ionicons name="search" size={18} color="#8F94A4" />
                        <BottomSheetTextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search lecturers by name or email..."
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

                    {/* List */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                    >
                        {loading ? (
                            <View className="items-center py-8">
                                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                <Text className="text-[13px] text-[#8F94A4] mt-2">Loading lecturers...</Text>
                            </View>
                        ) : filtered.length > 0 ? (
                            filtered.map((l) => {
                                const isCurrent = currentLecturerId != null && l.id === currentLecturerId;
                                const isAssigning = assigningId === l.id;
                                return (
                                    <Pressable
                                        key={l.id}
                                        onPress={() => handleAssign(l)}
                                        disabled={assigningId !== null}
                                        className="flex-row items-center p-3 rounded-[14px] bg-white mb-2 border border-[#E8EAF1] active:bg-[#F5F6FA]"
                                        style={assigningId !== null && !isAssigning ? { opacity: 0.5 } : undefined}
                                    >
                                        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F0EDFC]">
                                            <Text style={{ color: PRIMARY_COLOR, fontFamily: 'WorkSans_600SemiBold', fontSize: 15 }}>
                                                {initials(l.name)}
                                            </Text>
                                        </View>
                                        <View className="ml-3 flex-1">
                                            <Text className="font-medium text-[15px] text-[#181A20]" numberOfLines={1}>
                                                {l.name}
                                            </Text>
                                            <Text className="text-[12px] text-[#8F94A4] mt-0.5" numberOfLines={1}>
                                                {l.email}
                                            </Text>
                                        </View>
                                        {isAssigning ? (
                                            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                        ) : isCurrent ? (
                                            <View className="px-2 py-1 rounded-full bg-[#E8F5E9]">
                                                <Text className="text-[10px] font-medium text-[#4CAF50]">Current</Text>
                                            </View>
                                        ) : (
                                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                                        )}
                                    </Pressable>
                                );
                            })
                        ) : (
                            <View className="items-center py-8">
                                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF3E0] mb-3">
                                    <Ionicons name="person-outline" size={28} color="#FF9800" />
                                </View>
                                <Text className="font-medium text-[15px] text-[#181A20]">No lecturers found</Text>
                                <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                    {searchQuery
                                        ? 'Try a different search term'
                                        : 'Create a lecturer first, then assign them here'}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </BottomSheetView>
            </BottomSheetModal>
        );
    },
);

AssignLecturerBottomSheet.displayName = 'AssignLecturerBottomSheet';

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
