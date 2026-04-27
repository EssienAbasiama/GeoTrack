import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { CodeInput } from '../../components/auth/CodeInput';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export function VerifyEmailScreen({ navigation, route }: Props) {
    const { verifyRegistrationEmail, resendVerificationCode, authLoading, pendingEmail } = useAuth();
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(45);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleVerify = async () => {
        const result = await verifyRegistrationEmail(code);
        if (!result.ok) {
            Alert.alert('Verification failed', result.message || 'Invalid code.');
            return;
        }

        if (route.params.purpose === 'register') {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            return;
        }

        navigation.navigate('ResetPassword');
    };

    const handleResend = async () => {
        if (countdown > 0) return;
        await resendVerificationCode();
        setCountdown(45);
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Verify Email</Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#6B7280]">
                We sent a verification code to {pendingEmail || 'your email'}.
            </Text>

            <View className="mt-8 rounded-2xl bg-white p-5 shadow-sm shadow-black/5">
                <CodeInput value={code} onChange={setCode} />

                <Pressable
                    onPress={handleVerify}
                    disabled={code.length < 6 || authLoading}
                    className="mt-6 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
                    style={{ opacity: code.length < 6 || authLoading ? 0.6 : 1 }}
                >
                    <Text className="font-medium text-[15px] text-white">{authLoading ? 'Verifying...' : 'Verify Code'}</Text>
                </Pressable>

                <View className="mt-4 flex-row items-center justify-center">
                    <Text className="text-[13px] text-[#64748B]">Didn’t receive code?</Text>
                    <Pressable onPress={handleResend}>
                        <Text className="ml-1 text-[13px] font-semibold text-[#4F46E5]">
                            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                        </Text>
                    </Pressable>
                </View>

                <View className="mt-4 rounded-xl bg-[#EEF2FF] p-3">
                    <Text className="text-[12px] text-[#4B5563]">Demo code: 246810</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
