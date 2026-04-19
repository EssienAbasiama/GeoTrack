import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetScrollView,
    BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

const PRIMARY_COLOR = '#6343cc';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00',
];

type CreateMode = 'select' | 'class' | 'lecturer';
type PickerType = 'day' | 'startTime' | 'endTime' | null;

export interface AdminCreateBottomSheetRef {
    open: (initialMode?: 'select' | 'class' | 'lecturer') => void;
    close: () => void;
}

interface AdminCreateBottomSheetProps {
    onClose?: () => void;
}

export const AdminCreateBottomSheet = forwardRef<AdminCreateBottomSheetRef, AdminCreateBottomSheetProps>(
    ({ onClose }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();
        const [mode, setMode] = useState<CreateMode>('select');

        // Form states for class
        const [classCode, setClassCode] = useState('');
        const [className, setClassName] = useState('');
        const [venue, setVenue] = useState('');
        const [day, setDay] = useState('');
        const [startTime, setStartTime] = useState('');
        const [endTime, setEndTime] = useState('');

        // Form states for lecturer
        const [lecturerName, setLecturerName] = useState('');
        const [lecturerEmail, setLecturerEmail] = useState('');
        const [department, setDepartment] = useState('');

        // Picker state
        const [activePicker, setActivePicker] = useState<PickerType>(null);

        const snapPoints = useMemo(() => ['75%'], []);

        useImperativeHandle(ref, () => ({
            open: (initialMode?: 'select' | 'class' | 'lecturer') => {
                setMode(initialMode || 'select');
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const handleSheetChange = useCallback(
            (index: number) => {
                if (index === -1) {
                    setMode('select');
                    onClose?.();
                }
            },
            [onClose]
        );

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

        const handleClose = () => {
            Keyboard.dismiss();
            bottomSheetRef.current?.dismiss();
        };

        const handleBack = () => {
            Keyboard.dismiss();
            setMode('select');
        };

        const handleCreateClass = () => {
            console.log('Creating class:', { classCode, className, venue, day, startTime, endTime });
            setClassCode('');
            setClassName('');
            setVenue('');
            setDay('');
            setStartTime('');
            setEndTime('');
            handleClose();
        };

        const handleCreateLecturer = () => {
            console.log('Creating lecturer:', { lecturerName, lecturerEmail, department });
            setLecturerName('');
            setLecturerEmail('');
            setDepartment('');
            handleClose();
        };

        const renderSelectMode = () => (
            <View style={styles.contentWrapper}>
                <Text className="font-heading text-[24px] text-[#181A20] text-center mb-2">
                    Create New
                </Text>
                <Text className="text-[14px] text-[#8F94A4] text-center mb-8">
                    What would you like to create?
                </Text>

                <Pressable
                    onPress={() => setMode('class')}
                    className="mb-4 rounded-[20px] border-2 border-[#E8EAF1] bg-white p-5 active:bg-[#F5F6FA]"
                >
                    <View className="flex-row items-center">
                        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-[#F0EDFC]">
                            <Ionicons name="book" size={26} color={PRIMARY_COLOR} />
                        </View>
                        <View className="ml-4 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Create Class</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">
                                Add a new class to the system
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#8F94A4" />
                    </View>
                </Pressable>

                <Pressable
                    onPress={() => setMode('lecturer')}
                    className="mb-4 rounded-[20px] border-2 border-[#E8EAF1] bg-white p-5 active:bg-[#F5F6FA]"
                >
                    <View className="flex-row items-center">
                        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-[#E8F5E9]">
                            <Ionicons name="person-add" size={26} color="#4CAF50" />
                        </View>
                        <View className="ml-4 flex-1">
                            <Text className="font-heading text-[18px] text-[#181A20]">Create Lecturer</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">
                                Add a new lecturer to the system
                            </Text>
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
                            <Text className="text-[13px] text-[#8F94A4] mt-1">
                                Assign a lecturer to a class
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color="#8F94A4" />
                    </View>
                </Pressable>
            </View>
        );

        const renderClassForm = () => (
            <View style={styles.contentWrapper}>
                <View className="flex-row items-center mb-4">
                    <Pressable onPress={handleBack} className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3">
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Create Class</Text>
                </View>

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

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Venue *</Text>
                    <TextInput
                        value={venue}
                        onChangeText={setVenue}
                        placeholder="e.g., LT 201"
                        placeholderTextColor="#B8BBC6"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Day *</Text>
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

                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Start Time</Text>
                        <Pressable
                            onPress={() => setActivePicker('startTime')}
                            className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center justify-between"
                        >
                            <Text className={startTime ? 'text-[15px] text-[#181A20]' : 'text-[15px] text-[#B8BBC6]'}>
                                {startTime || '09:00'}
                            </Text>
                            <Ionicons name="time-outline" size={20} color="#8F94A4" />
                        </Pressable>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">End Time</Text>
                        <Pressable
                            onPress={() => setActivePicker('endTime')}
                            className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 flex-row items-center justify-between"
                        >
                            <Text className={endTime ? 'text-[15px] text-[#181A20]' : 'text-[15px] text-[#B8BBC6]'}>
                                {endTime || '11:00'}
                            </Text>
                            <Ionicons name="time-outline" size={20} color="#8F94A4" />
                        </Pressable>
                    </View>
                </View>

                <Pressable
                    onPress={handleCreateClass}
                    className="mt-4 h-14 items-center justify-center rounded-[14px] bg-[#6343cc]"
                >
                    <Text className="font-medium text-[16px] text-white">Create Class</Text>
                </Pressable>
            </View>
        );

        const renderLecturerForm = () => (
            <View style={styles.contentWrapper}>
                <View className="flex-row items-center mb-4">
                    <Pressable onPress={handleBack} className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3">
                        <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Create Lecturer</Text>
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Full Name *</Text>
                    <TextInput
                        value={lecturerName}
                        onChangeText={setLecturerName}
                        placeholder="e.g., Dr. Adewale Johnson"
                        placeholderTextColor="#B8BBC6"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Email Address *</Text>
                    <TextInput
                        value={lecturerEmail}
                        onChangeText={setLecturerEmail}
                        placeholder="e.g., a.johnson@university.edu"
                        placeholderTextColor="#B8BBC6"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Department *</Text>
                    <TextInput
                        value={department}
                        onChangeText={setDepartment}
                        placeholder="e.g., Electrical Engineering"
                        placeholderTextColor="#B8BBC6"
                        className="h-14 rounded-[14px] border border-[#E8EAF1] bg-white px-4 text-[15px] text-[#181A20]"
                    />
                </View>

                <Pressable
                    onPress={handleCreateLecturer}
                    className="mt-4 h-14 items-center justify-center rounded-[14px] bg-[#4CAF50]"
                >
                    <Text className="font-medium text-[16px] text-white">Create Lecturer</Text>
                </Pressable>
            </View>
        );

        const getPickerTitle = () => {
            switch (activePicker) {
                case 'day': return 'Select Day';
                case 'startTime': return 'Select Start Time';
                case 'endTime': return 'Select End Time';
                default: return '';
            }
        };

        const getPickerOptions = () => {
            return activePicker === 'day' ? DAYS_OF_WEEK : TIME_OPTIONS;
        };

        const getSelectedValue = () => {
            switch (activePicker) {
                case 'day': return day;
                case 'startTime': return startTime;
                case 'endTime': return endTime;
                default: return '';
            }
        };

        const handlePickerSelect = (value: string) => {
            switch (activePicker) {
                case 'day':
                    setDay(value);
                    break;
                case 'startTime':
                    setStartTime(value);
                    break;
                case 'endTime':
                    setEndTime(value);
                    break;
            }
            setActivePicker(null);
        };

        const renderPickerModal = () => (
            <Modal
                visible={activePicker !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setActivePicker(null)}
            >
                <Pressable
                    className="flex-1 bg-black/40 justify-end"
                    onPress={() => setActivePicker(null)}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-white rounded-t-[28px]"
                        style={{ paddingBottom: Math.max(insets.bottom, 20) }}
                    >
                        {/* Handle */}
                        <View className="items-center py-3">
                            <View className="h-[5px] w-14 rounded-full bg-[#D7DBE6]" />
                        </View>

                        {/* Header */}
                        <View className="flex-row items-center justify-between px-5 pb-4">
                            <Text className="font-heading text-[20px] text-[#181A20]">
                                {getPickerTitle()}
                            </Text>
                            <Pressable
                                onPress={() => setActivePicker(null)}
                                className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                            >
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>

                        {/* Options */}
                        <ScrollView
                            className="max-h-[300px]"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
                        >
                            {getPickerOptions().map((option) => {
                                const isSelected = option === getSelectedValue();
                                return (
                                    <Pressable
                                        key={option}
                                        onPress={() => handlePickerSelect(option)}
                                        className={`h-14 rounded-[14px] mb-2 px-4 flex-row items-center justify-between ${isSelected ? 'bg-[#F0EDFC] border-2 border-[#6343cc]' : 'bg-[#F5F6FA]'
                                            }`}
                                    >
                                        <Text
                                            className={`text-[16px] ${isSelected ? 'font-medium text-[#6343cc]' : 'text-[#181A20]'
                                                }`}
                                        >
                                            {option}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={22} color={PRIMARY_COLOR} />
                                        )}
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
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingBottom: Math.max(insets.bottom, 20) + 20 },
                        ]}
                    >
                        {mode === 'select' && renderSelectMode()}
                        {mode === 'class' && renderClassForm()}
                        {mode === 'lecturer' && renderLecturerForm()}
                    </BottomSheetScrollView>
                </BottomSheetModal>
                {renderPickerModal()}
            </>
        );
    }
);

AdminCreateBottomSheet.displayName = 'AdminCreateBottomSheet';

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
    scrollContent: {
        paddingTop: 8,
    },
    contentWrapper: {
        paddingHorizontal: 20,
    },
});
