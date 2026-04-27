import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation }: Props) {
    const { resetPassword, authLoading } = useAuth();
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleReset = async () => {
        if (!code.trim() || !password.trim() || !confirmPassword.trim()) {
            Alert.alert('Incomplete details', 'Fill all fields.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Password mismatch', 'Passwords do not match.');
            return;
        }

        const result = await resetPassword(code.trim(), password);
        if (!result.ok) {
            Alert.alert('Reset failed', result.message || 'Invalid code.');
            return;
        }

        Alert.alert('Password reset', 'Your password has been changed.', [
            { text: 'OK', onPress: () => navigation.replace('Login') },
        ]);
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Reset Password</Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#6B7280]">Enter the code sent to your email and create a new password.</Text>

            <View className="mt-8 gap-4">
                <View>
                    <Text className="mb-2 text-[13px] text-[#4B5563]">Reset Code</Text>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        keyboardType="number-pad"
                        className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]"
                        placeholder="6-digit code"
                    />
                </View>

                <View>
                    <Text className="mb-2 text-[13px] text-[#4B5563]">New Password</Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]"
                        placeholder="Enter new password"
                    />
                </View>

                <View>
                    <Text className="mb-2 text-[13px] text-[#4B5563]">Confirm Password</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]"
                        placeholder="Re-enter new password"
                    />
                </View>
            </View>

            <View className="mt-4 rounded-xl bg-[#EEF2FF] p-3">
                <Text className="text-[12px] text-[#4B5563]">Demo reset code: 135790</Text>
            </View>

            <Pressable
                onPress={handleReset}
                disabled={authLoading}
                className="mt-8 h-14 items-center justify-center rounded-2xl bg-[#4F46E5]"
                style={{ opacity: authLoading ? 0.7 : 1 }}
            >
                <Text className="font-medium text-[16px] text-white">{authLoading ? 'Updating...' : 'Update Password'}</Text>
            </Pressable>
        </SafeAreaView>
    );
}
