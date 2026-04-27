import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
    const { signIn, authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignIn = async () => {
        const result = await signIn(email, password);
        if (!result.ok) {
            Alert.alert('Sign in failed', result.message || 'Please try again.');
            return;
        }
        navigation.replace('MainTabs');
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <Text className="font-heading text-[30px] text-[#181A20]">Welcome Back</Text>
            <Text className="mt-2 text-[14px] text-[#6B7280]">Sign in to continue attendance and class management.</Text>

            <View className="mt-8 gap-4">
                <View>
                    <Text className="mb-2 text-[13px] text-[#4B5563]">Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#111827]"
                        placeholder="you@school.edu"
                    />
                </View>

                <View>
                    <Text className="mb-2 text-[13px] text-[#4B5563]">Password</Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#111827]"
                        placeholder="Enter password"
                    />
                </View>
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
