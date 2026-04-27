import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
    const { requestPasswordReset, authLoading } = useAuth();
    const [email, setEmail] = useState('');

    const handleSendCode = async () => {
        const result = await requestPasswordReset(email);
        if (!result.ok) {
            Alert.alert('Request failed', result.message || 'Unable to send code.');
            return;
        }
        navigation.navigate('VerifyEmail', { purpose: 'password-reset' });
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Forgot Password</Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#6B7280]">Enter your email and we will send a reset code.</Text>

            <View className="mt-8">
                <Text className="mb-2 text-[13px] text-[#4B5563]">Email</Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]"
                    placeholder="you@school.edu"
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
