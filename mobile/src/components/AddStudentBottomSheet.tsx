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
    Keyboard,
    Modal,
    Pressable,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { courseApi } from '../services/apiClient';

const PRIMARY_COLOR = '#6343cc';

interface StudentResult {
    id: number;
    name: string;
    matricNo: string;
    email: string;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AddStudentBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface AddStudentBottomSheetProps {
    classCode: string;
    onAddStudent: (student: { id: number; name: string; matricNo: string; email: string }) => void;
}

export const AddStudentBottomSheet = forwardRef<AddStudentBottomSheetRef, AddStudentBottomSheetProps>(
    ({ classCode, onAddStudent }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();

        const [searchQuery, setSearchQuery] = useState('');
        const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
        const [isSearching, setIsSearching] = useState(false);
        const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
        const [showConfirmation, setShowConfirmation] = useState(false);
        const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
        const searchSeq = useRef(0);

        const snapPoints = useMemo(() => ['60%', '85%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
                setSearchQuery('');
                setSearchResults([]);
                setSelectedStudent(null);
                setShowConfirmation(false);
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        // Debounced lookup against the real student directory. Searching by
        // email, matric number, or name all hit the same endpoint.
        const handleSearch = useCallback((query: string) => {
            setSearchQuery(query);

            if (searchTimer.current) clearTimeout(searchTimer.current);

            const trimmed = query.trim();
            if (trimmed.length < 2) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            const seq = ++searchSeq.current;

            searchTimer.current = setTimeout(async () => {
                try {
                    const { data } = await courseApi.searchStudents(trimmed);
                    if (seq !== searchSeq.current) return; // a newer search won
                    setSearchResults(
                        (data.students ?? []).map((s) => ({
                            id: s.id,
                            name: s.name,
                            email: s.email,
                            matricNo: s.matric_no ?? '',
                        })),
                    );
                } catch {
                    if (seq === searchSeq.current) setSearchResults([]);
                } finally {
                    if (seq === searchSeq.current) setIsSearching(false);
                }
            }, 350);
        }, []);

        const handleStudentSelect = (student: StudentResult) => {
            Keyboard.dismiss();
            setSelectedStudent(student);
            setShowConfirmation(true);
        };

        const handleConfirmAdd = () => {
            if (selectedStudent) {
                onAddStudent({
                    id: selectedStudent.id,
                    name: selectedStudent.name,
                    matricNo: selectedStudent.matricNo,
                    email: selectedStudent.email,
                });
                setShowConfirmation(false);
                setSelectedStudent(null);
                setSearchQuery('');
                setSearchResults([]);
                bottomSheetRef.current?.dismiss();
            }
        };

        const handleCancelAdd = () => {
            setShowConfirmation(false);
            setSelectedStudent(null);
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
            <>
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
                            <Text className="font-heading text-[20px] text-[#181A20]">Add Student</Text>
                            <Pressable
                                onPress={() => bottomSheetRef.current?.dismiss()}
                                className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                            >
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        </View>

                        {/* Search Input */}
                        <View className="flex-row items-center h-[52px] rounded-[14px] bg-white border border-[#E8EAF1] px-4 mb-4">
                            <Ionicons name="search" size={18} color="#8F94A4" />
                            <BottomSheetTextInput
                                value={searchQuery}
                                onChangeText={handleSearch}
                                placeholder="Search by matric no. or email..."
                                placeholderTextColor="#B8BBC6"
                                style={styles.searchInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => handleSearch('')}>
                                    <Ionicons name="close-circle" size={20} color="#B8BBC6" />
                                </Pressable>
                            )}
                        </View>

                        {/* Search Results */}
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                        >
                            {isSearching ? (
                                <View className="items-center py-8">
                                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                    <Text className="text-[13px] text-[#8F94A4] mt-2">Searching...</Text>
                                </View>
                            ) : searchResults.length > 0 ? (
                                <View>
                                    <Text className="text-[12px] text-[#8F94A4] mb-3">
                                        {searchResults.length} student{searchResults.length !== 1 ? 's' : ''} found
                                    </Text>
                                    {searchResults.map((student) => (
                                        <Pressable
                                            key={student.id}
                                            onPress={() => handleStudentSelect(student)}
                                            className="flex-row items-center p-3 rounded-[14px] bg-white mb-2 border border-[#E8EAF1] active:bg-[#F5F6FA]"
                                        >
                                            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#EDE9FC]">
                                                <Text className="font-heading text-[14px] text-[#6343cc]">
                                                    {getInitials(student.name)}
                                                </Text>
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <Text className="font-medium text-[15px] text-[#181A20]">
                                                    {student.name}
                                                </Text>
                                                <Text className="text-[12px] text-[#8F94A4] mt-0.5">
                                                    {student.matricNo ? `${student.matricNo} • ` : ''}{student.email}
                                                </Text>
                                            </View>
                                            <Ionicons name="add-circle" size={24} color={PRIMARY_COLOR} />
                                        </Pressable>
                                    ))}
                                </View>
                            ) : searchQuery.length >= 2 ? (
                                <View className="items-center py-8">
                                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF3E0] mb-3">
                                        <Ionicons name="person-outline" size={28} color="#FF9800" />
                                    </View>
                                    <Text className="font-medium text-[15px] text-[#181A20]">No students found</Text>
                                    <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                        Try searching with a different{'\n'}matric number or email
                                    </Text>
                                </View>
                            ) : (
                                <View className="items-center py-8">
                                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F0EDFC] mb-3">
                                        <Ionicons name="search" size={28} color={PRIMARY_COLOR} />
                                    </View>
                                    <Text className="font-medium text-[15px] text-[#181A20]">Search for a student</Text>
                                    <Text className="text-[13px] text-[#8F94A4] mt-1 text-center">
                                        Enter at least 2 characters to search{'\n'}by matric number or email
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </BottomSheetView>
                </BottomSheetModal>

                {/* Confirmation Modal */}
                <Modal
                    visible={showConfirmation}
                    transparent
                    animationType="fade"
                    onRequestClose={handleCancelAdd}
                >
                    <Pressable
                        className="flex-1 bg-black/50 items-center justify-center px-6"
                        onPress={handleCancelAdd}
                    >
                        <Pressable
                            onPress={(e) => e.stopPropagation()}
                            className="w-full bg-white rounded-[24px] p-6"
                        >
                            {/* Student Info */}
                            <View className="items-center mb-6">
                                {selectedStudent && (
                                    <>
                                        <View className="h-20 w-20 items-center justify-center rounded-full bg-[#EDE9FC] mb-4">
                                            <Text className="font-heading text-[24px] text-[#6343cc]">
                                                {getInitials(selectedStudent.name)}
                                            </Text>
                                        </View>
                                        <Text className="font-heading text-[18px] text-[#181A20] text-center">
                                            {selectedStudent.name}
                                        </Text>
                                        <Text className="text-[13px] text-[#8F94A4] mt-1">
                                            {selectedStudent.matricNo || selectedStudent.email}
                                        </Text>
                                    </>
                                )}
                            </View>

                            {/* Confirmation Message */}
                            <View className="items-center mb-6">
                                <Text className="text-[15px] text-[#5A5D6B] text-center">
                                    Add this student to
                                </Text>
                                <View className="flex-row items-center mt-2">
                                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#F0EDFC] mr-2">
                                        <Ionicons name="book" size={16} color={PRIMARY_COLOR} />
                                    </View>
                                    <Text className="font-heading text-[16px] text-[#181A20]">
                                        {classCode}
                                    </Text>
                                </View>
                            </View>

                            {/* Action Buttons */}
                            <View className="flex-row gap-3">
                                <Pressable
                                    onPress={handleCancelAdd}
                                    className="flex-1 h-14 items-center justify-center rounded-[14px] bg-[#F1F2F6]"
                                >
                                    <Text className="font-medium text-[16px] text-[#5A5D6B]">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleConfirmAdd}
                                    className="flex-1 h-14 items-center justify-center rounded-[14px] bg-[#6343cc]"
                                >
                                    <Text className="font-medium text-[16px] text-white">Add Student</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            </>
        );
    }
);

AddStudentBottomSheet.displayName = 'AddStudentBottomSheet';

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
