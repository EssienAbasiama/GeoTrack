import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { ValidatedInput } from '../../components/ValidatedInput';
import useFormValidation, { validators } from '../../hooks/useFormValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation }: Props) {
    const { resetPassword, authLoading } = useAuth();

    const form = useFormValidation({
        code: {
            rules: [
                validators.required('Enter the 6-digit code'),
                validators.digitsOnly(6, 'Must be a 6-digit code'),
            ],
        },
        password: {
            rules: [
                validators.required('Enter a new password'),
                validators.minLength(8, 'Password must be at least 8 characters'),
            ],
        },
        confirmPassword: {
            rules: [
                validators.required('Please confirm your new password'),
                validators.matches('password', 'Passwords do not match'),
            ],
        },
    });

    const handleReset = async () => {
        const { valid } = form.validateAll();
        if (!valid) return;

        const result = await resetPassword(form.values.code, form.values.password);
        if (!result.ok) {
            form.setError('code', result.message ?? 'Invalid code. Please try again.');
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
                <ValidatedInput
                    label="Reset Code"
                    value={form.values.code}
                    onChangeText={v => form.setValue('code', v)}
                    error={form.errors.code}
                    keyboardType="number-pad"
                    placeholder="6-digit code"
                    maxLength={6}
                />

                <ValidatedInput
                    label="New Password"
                    value={form.values.password}
                    onChangeText={v => form.setValue('password', v)}
                    error={form.errors.password}
                    secure
                    placeholder="Enter new password"
                    textContentType="newPassword"
                />

                <ValidatedInput
                    label="Confirm Password"
                    value={form.values.confirmPassword}
                    onChangeText={v => form.setValue('confirmPassword', v)}
                    error={form.errors.confirmPassword}
                    secure
                    placeholder="Re-enter new password"
                    textContentType="newPassword"
                />
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
