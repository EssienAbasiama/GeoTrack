import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { ValidatedInput } from '../../components/ValidatedInput';
import useFormValidation, { validators } from '../../hooks/useFormValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
    const { signIn, authLoading } = useAuth();

    const form = useFormValidation(
        {
            email: { rules: [validators.required(), validators.email()] },
            password: { rules: [validators.required('Please enter your password')] },
        },
    );

    const handleSignIn = async () => {
        const { valid } = form.validateAll();
        if (!valid) return;

        const result = await signIn(form.values.email, form.values.password);
        if (!result.ok) {
            // Surface server error inline on the email field so the user sees it
            form.setError('email', result.message ?? 'Sign in failed. Please try again.');
        }
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Welcome Back</Text>
            <Text className="mt-2 text-[14px] text-[#6B7280]">Sign in to continue attendance and class management.</Text>

            <View className="mt-8 gap-4">
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

                <ValidatedInput
                    label="Password"
                    value={form.values.password}
                    onChangeText={v => form.setValue('password', v)}
                    error={form.errors.password}
                    secure
                    placeholder="Enter password"
                    textContentType="password"
                />
            </View>

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} className="mt-3 self-end">
                <Text className="text-[13px] font-medium text-[#4F46E5]">Forgot password?</Text>
            </Pressable>

            <Pressable
                onPress={handleSignIn}
                disabled={authLoading}
                className="mt-8 h-14 items-center justify-center rounded-2xl bg-[#4F46E5]"
                style={{ opacity: authLoading ? 0.7 : 1 }}
            >
                <Text className="font-medium text-[16px] text-white">{authLoading ? 'Signing in...' : 'Sign In'}</Text>
            </Pressable>

            <View className="mt-6 flex-row items-center justify-center">
                <Text className="text-[13px] text-[#6B7280]">New here?</Text>
                <Pressable onPress={() => navigation.navigate('Register')}>
                    <Text className="ml-1 text-[13px] font-semibold text-[#4F46E5]">Create account</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
