import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../store/AuthContext';

const PRIMARY = '#6343cc';

function PasswordField({
    label, value, onChangeText, placeholder,
}: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string }) {
    const [show, setShow] = useState(false);
    return (
        <View className="mb-4">
            <Text className="text-[12px] text-[#8F94A4] mb-2" style={{ fontFamily: 'WorkSans_500Medium' }}>{label}</Text>
            <View className="flex-row items-center h-[54px] rounded-[14px] bg-white border border-[#E8EAF1] px-4">
                <Ionicons name="lock-closed-outline" size={18} color="#8F94A4" />
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#B8BBC6"
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    className="flex-1 ml-3 text-[15px] text-[#181A20]"
                />
                <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
                    <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8F94A4" />
                </Pressable>
            </View>
        </View>
    );
}

export function PasswordManagerScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { changePassword } = useAuth();

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);

    const rules = [
        { label: 'At least 8 characters', ok: next.length >= 8 },
        { label: 'Contains a number', ok: /\d/.test(next) },
        { label: 'Passwords match', ok: next.length > 0 && next === confirm },
    ];
    const canSubmit = current.length > 0 && rules.every((r) => r.ok);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        const res = await changePassword(current, next);
        setSaving(false);
        if (res.ok) {
            Toast.show({ type: 'success', text1: 'Password changed successfully.', position: 'bottom' });
            navigation.goBack();
        } else {
            Toast.show({ type: 'error', text1: res.message ?? 'Could not change password.', position: 'bottom' });
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="px-5 pt-3 pb-2 flex-row items-center">
                <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5 mr-3">
                    <Ionicons name="arrow-back" size={20} color="#181A20" />
                </Pressable>
                <Text className="font-heading text-[20px] text-[#181A20]">Password Manager</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <View className="items-center mb-6">
                    <View className="h-16 w-16 items-center justify-center rounded-[20px] bg-[#F0EDFC] mb-3">
                        <Ionicons name="shield-checkmark" size={30} color={PRIMARY} />
                    </View>
                    <Text className="text-[13px] text-[#8F94A4] text-center px-6">
                        Choose a strong password. Changing it signs out your other devices.
                    </Text>
                </View>

                <PasswordField label="Current Password" value={current} onChangeText={setCurrent} placeholder="Enter current password" />
                <PasswordField label="New Password" value={next} onChangeText={setNext} placeholder="Enter new password" />
                <PasswordField label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter new password" />

                <View className="rounded-[14px] bg-white border border-[#E8EAF1] p-4 mb-6">
                    {rules.map((r) => (
                        <View key={r.label} className="flex-row items-center py-1">
                            <Ionicons
                                name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                                size={16}
                                color={r.ok ? '#22C55E' : '#C7C9D2'}
                            />
                            <Text className="ml-2 text-[13px]" style={{ color: r.ok ? '#22C55E' : '#8F94A4' }}>{r.label}</Text>
                        </View>
                    ))}
                </View>

                <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit || saving}
                    className="h-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: canSubmit ? PRIMARY : '#C7C9D2', opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <Text className="font-medium text-[16px] text-white">Update Password</Text>
                    )}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
