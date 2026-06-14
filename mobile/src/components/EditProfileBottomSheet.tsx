import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { useAuth } from '../store/AuthContext';

const PRIMARY = '#6343cc';

export interface EditProfileBottomSheetRef {
    open: () => void;
    close: () => void;
}

export const EditProfileBottomSheet = forwardRef<EditProfileBottomSheetRef, object>((_props, ref) => {
    const bsRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const { user, updateProfile } = useAuth();

    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const snapPoints = useMemo(() => ['55%'], []);

    useImperativeHandle(ref, () => ({
        open: () => {
            setName(user?.name ?? '');
            setSaving(false);
            bsRef.current?.present();
        },
        close: () => bsRef.current?.dismiss(),
    }));

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    );

    const handleSave = async () => {
        if (!name.trim()) {
            Toast.show({ type: 'error', text1: 'Name cannot be empty.', position: 'bottom' });
            return;
        }
        setSaving(true);
        const res = await updateProfile({ name: name.trim() });
        setSaving(false);
        if (res.ok) {
            Toast.show({ type: 'success', text1: 'Profile updated.', position: 'bottom' });
            bsRef.current?.dismiss();
        } else {
            Toast.show({ type: 'error', text1: res.message ?? 'Could not update profile.', position: 'bottom' });
        }
    };

    return (
        <BottomSheetModal
            ref={bsRef}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            enablePanDownToClose
            keyboardBehavior="extend"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            handleIndicatorStyle={styles.handle}
            backgroundStyle={styles.bg}
        >
            <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View className="flex-row items-center justify-between mb-5">
                    <Text className="font-heading text-[20px] text-[#181A20]">Edit Profile</Text>
                    <Pressable
                        onPress={() => bsRef.current?.dismiss()}
                        className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                    >
                        <Ionicons name="close" size={18} color="#5A5D6B" />
                    </Pressable>
                </View>

                <Text style={styles.label}>Full Name</Text>
                <View style={styles.field}>
                    <Ionicons name="person-outline" size={18} color="#8F94A4" />
                    <BottomSheetTextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Your full name"
                        placeholderTextColor="#B8BBC6"
                        style={styles.input}
                    />
                </View>

                {/* Read-only identity fields */}
                <Text style={styles.label}>Email</Text>
                <View style={[styles.field, styles.fieldDisabled]}>
                    <Ionicons name="mail-outline" size={18} color="#B8BBC6" />
                    <Text style={[styles.input, { color: '#8F94A4' }]} numberOfLines={1}>{user?.email ?? '—'}</Text>
                    <Ionicons name="lock-closed" size={14} color="#C7C9D2" />
                </View>

                {user?.matricNo ? (
                    <>
                        <Text style={styles.label}>Matric Number</Text>
                        <View style={[styles.field, styles.fieldDisabled]}>
                            <Ionicons name="id-card-outline" size={18} color="#B8BBC6" />
                            <Text style={[styles.input, { color: '#8F94A4' }]}>{user.matricNo}</Text>
                            <Ionicons name="lock-closed" size={14} color="#C7C9D2" />
                        </View>
                    </>
                ) : null}

                <Text className="text-[11px] text-[#9CA3AF] mt-2 mb-4">
                    Email and matric number are tied to your verified identity and can't be changed here.
                </Text>

                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className="h-14 items-center justify-center rounded-[14px] bg-[#6343cc]"
                    style={{ opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <Text className="font-medium text-[16px] text-white">Save Changes</Text>
                    )}
                </Pressable>
            </BottomSheetView>
        </BottomSheetModal>
    );
});

EditProfileBottomSheet.displayName = 'EditProfileBottomSheet';

const styles = StyleSheet.create({
    bg: { backgroundColor: '#F6F6F9', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    handle: { width: 88, height: 4, borderRadius: 3, backgroundColor: '#BCBDC0', alignSelf: 'center' },
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    label: { fontSize: 12, color: '#8F94A4', marginBottom: 6, marginTop: 12, fontFamily: 'WorkSans_500Medium' },
    field: {
        flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8EAF1', paddingHorizontal: 14,
    },
    fieldDisabled: { backgroundColor: '#F1F2F6' },
    input: { flex: 1, fontSize: 15, color: '#181A20', fontFamily: 'WorkSans_400Regular', marginLeft: 10 },
});
