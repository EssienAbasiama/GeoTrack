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
    Modal,
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

const PRIMARY_COLOR = '#6343cc';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00',
];

export interface EditClassValues {
    code: string;
    title: string;
    department: string;
    venue: string;
    day: string;
    startTime: string;
    endTime: string;
}

export interface EditClassBottomSheetRef {
    open: (initial: EditClassValues) => void;
    close: () => void;
}

interface EditClassBottomSheetProps {
    onSave: (values: EditClassValues) => Promise<void>;
}

export const EditClassBottomSheet = forwardRef<EditClassBottomSheetRef, EditClassBottomSheetProps>(
    ({ onSave }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();

        const [code, setCode] = useState('');
        const [title, setTitle] = useState('');
        const [department, setDepartment] = useState('');
        const [venue, setVenue] = useState('');
        const [day, setDay] = useState('');
        const [startTime, setStartTime] = useState('');
        const [endTime, setEndTime] = useState('');
        const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null);
        const [saving, setSaving] = useState(false);

        const snapPoints = useMemo(() => ['75%', '90%'], []);

        useImperativeHandle(ref, () => ({
            open: (initial) => {
                setCode(initial.code ?? '');
                setTitle(initial.title ?? '');
                setDepartment(initial.department ?? '');
                setVenue(initial.venue ?? '');
                setDay(initial.day ?? '');
                setStartTime(initial.startTime ?? '');
                setEndTime(initial.endTime ?? '');
                setSaving(false);
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const renderBackdrop = (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        );

        const handleSave = async () => {
            if (!code.trim() || !title.trim()) {
                Toast.show({ type: 'error', text1: 'Code and title are required.', position: 'bottom' });
                return;
            }
            setSaving(true);
            try {
                await onSave({
                    code: code.trim(),
                    title: title.trim(),
                    department: department.trim(),
                    venue: venue.trim(),
                    day: day.trim(),
                    startTime: startTime.trim(),
                    endTime: endTime.trim(),
                });
                bottomSheetRef.current?.dismiss();
            } catch {
                // onSave surfaces its own error toast.
            } finally {
                setSaving(false);
            }
        };

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
                        <Text className="font-heading text-[20px] text-[#181A20]">Edit Class</Text>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 16 }}
                    >
                        {/* Code */}
                        <Text style={styles.label}>Class Code</Text>
                        <View style={styles.field}>
                            <BottomSheetTextInput
                                value={code}
                                onChangeText={setCode}
                                placeholder="e.g. CSC401"
                                placeholderTextColor="#B8BBC6"
                                autoCapitalize="characters"
                                style={styles.input}
                            />
                        </View>

                        {/* Title */}
                        <Text style={styles.label}>Title</Text>
                        <View style={styles.field}>
                            <BottomSheetTextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="e.g. Software Engineering"
                                placeholderTextColor="#B8BBC6"
                                style={styles.input}
                            />
                        </View>

                        {/* Department */}
                        <Text style={styles.label}>Department</Text>
                        <View style={styles.field}>
                            <BottomSheetTextInput
                                value={department}
                                onChangeText={setDepartment}
                                placeholder="e.g. Computer Science"
                                placeholderTextColor="#B8BBC6"
                                style={styles.input}
                            />
                        </View>

                        {/* Venue */}
                        <Text style={styles.label}>Venue</Text>
                        <View style={styles.field}>
                            <Ionicons name="location-outline" size={18} color="#8F94A4" />
                            <BottomSheetTextInput
                                value={venue}
                                onChangeText={setVenue}
                                placeholder="e.g. Engineering Auditorium"
                                placeholderTextColor="#B8BBC6"
                                style={[styles.input, { marginLeft: 10 }]}
                            />
                        </View>

                        {/* Day */}
                        <Text style={styles.label}>Day</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {DAYS.map((d) => {
                                const active = day === d;
                                return (
                                    <Pressable
                                        key={d}
                                        onPress={() => setDay(d)}
                                        style={{
                                            paddingHorizontal: 14,
                                            height: 38,
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: active ? PRIMARY_COLOR : '#fff',
                                            borderWidth: 1,
                                            borderColor: active ? PRIMARY_COLOR : '#E8EAF1',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontFamily: 'WorkSans_500Medium',
                                                color: active ? '#fff' : '#5A5D6B',
                                            }}
                                        >
                                            {d.slice(0, 3)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {/* Time */}
                        <View className="flex-row" style={{ gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Start Time</Text>
                                <Pressable style={styles.field} onPress={() => setTimePicker('start')}>
                                    <Ionicons name="time-outline" size={18} color="#8F94A4" />
                                    <Text
                                        style={[styles.input, { marginLeft: 10 }, !startTime && { color: '#B8BBC6' }]}
                                    >
                                        {startTime || '09:00'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#B8BBC6" />
                                </Pressable>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>End Time</Text>
                                <Pressable style={styles.field} onPress={() => setTimePicker('end')}>
                                    <Ionicons name="time-outline" size={18} color="#8F94A4" />
                                    <Text
                                        style={[styles.input, { marginLeft: 10 }, !endTime && { color: '#B8BBC6' }]}
                                    >
                                        {endTime || '11:00'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#B8BBC6" />
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Save */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        className="h-14 items-center justify-center rounded-[14px] bg-[#6343cc] mt-2"
                        style={{ opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="font-medium text-[16px] text-white">Save Changes</Text>
                        )}
                    </Pressable>

                    {/* Time picker */}
                    <Modal
                        visible={timePicker !== null}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setTimePicker(null)}
                    >
                        <Pressable
                            className="flex-1 bg-black/40 justify-end"
                            onPress={() => setTimePicker(null)}
                        >
                            <Pressable
                                onPress={(e) => e.stopPropagation()}
                                className="bg-white rounded-t-[24px] px-5 pt-3"
                                style={{ paddingBottom: Math.max(insets.bottom, 20), maxHeight: '60%' }}
                            >
                                <View className="items-center mb-2">
                                    <View className="h-1 w-10 rounded-full bg-[#E2E0E8]" />
                                </View>
                                <Text className="font-heading text-[16px] text-[#181A20] mb-2">
                                    {timePicker === 'start' ? 'Start Time' : 'End Time'}
                                </Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {TIME_OPTIONS.map((t) => {
                                        const current = timePicker === 'start' ? startTime : endTime;
                                        const active = current === t;
                                        return (
                                            <Pressable
                                                key={t}
                                                onPress={() => {
                                                    if (timePicker === 'start') setStartTime(t);
                                                    else setEndTime(t);
                                                    setTimePicker(null);
                                                }}
                                                className="flex-row items-center justify-between py-3 px-2 rounded-[10px] active:bg-[#F5F6FA]"
                                            >
                                                <Text
                                                    className="text-[15px]"
                                                    style={{ color: active ? PRIMARY_COLOR : '#181A20', fontFamily: active ? 'WorkSans_600SemiBold' : 'WorkSans_400Regular' }}
                                                >
                                                    {t}
                                                </Text>
                                                {active && <Ionicons name="checkmark-circle" size={20} color={PRIMARY_COLOR} />}
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </Pressable>
                        </Pressable>
                    </Modal>
                </BottomSheetView>
            </BottomSheetModal>
        );
    },
);

EditClassBottomSheet.displayName = 'EditClassBottomSheet';

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
    label: {
        fontSize: 12,
        color: '#8F94A4',
        marginBottom: 6,
        marginTop: 14,
        fontFamily: 'WorkSans_500Medium',
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E8EAF1',
        paddingHorizontal: 14,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#181A20',
        fontFamily: 'WorkSans_400Regular',
    },
});
