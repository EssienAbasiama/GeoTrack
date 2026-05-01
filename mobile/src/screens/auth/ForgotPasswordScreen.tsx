import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { ValidatedInput } from '../../components/ValidatedInput';
import useFormValidation, { validators } from '../../hooks/useFormValidation';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
    const { requestPasswordReset, authLoading } = useAuth();

    const form = useFormValidation({
        email: { rules: [validators.required(), validators.email()] },
    });

    const handleSendCode = async () => {
        const { valid } = form.validateAll();
        if (!valid) return;

        const result = await requestPasswordReset(form.values.email);
        if (!result.ok) {
            Toast.show({ type: 'error', text1: result.message ?? 'Unable to send code. Please try again.', position: "bottom" });
            return;
        }
        navigation.navigate('VerifyEmail', { purpose: 'password-reset' });
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Forgot Password</Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#6B7280]">Enter your email and we will send a reset code.</Text>

            <View className="mt-8">
                <ValidatedInput
                    label="Email"
                    value={form.values.email}
                    onChangeText={v => form.setValue('email', v)}
                    error={form.errors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="you@school.edu"
                    textContentType="emailAddress"
                />
            </View>

            <Pressable
                onPress={handleSendCode}
                disabled={authLoading}
                className="mt-8 h-14 items-center justify-center rounded-2xl bg-[#4F46E5]"
                style={{ opacity: authLoading ? 0.7 : 1 }}
            >
                <Text className="font-medium text-[16px] text-white">{authLoading ? 'Sending...' : 'Send Verification Code'}</Text>
            </Pressable>
        </SafeAreaView>
    );
}
