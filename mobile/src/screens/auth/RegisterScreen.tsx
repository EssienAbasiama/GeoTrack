import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { ValidatedInput } from '../../components/ValidatedInput';
import useFormValidation, { validators } from '../../hooks/useFormValidation';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type RegisterRole = 'student' | 'lecturer';

export function RegisterScreen({ navigation, route }: Props) {
    const { startRegistration, authLoading } = useAuth();
    const [role, setRole] = useState<RegisterRole>(route.params?.inviteRole ?? 'student');

    const inviteToken = route.params?.inviteToken ?? '';
    const roleLockedByInvite = Boolean(route.params?.inviteRole);

    const inviteMeta = useMemo(() => ({
        token: inviteToken || undefined,
        roleHint: route.params?.inviteRole,
        department: route.params?.department,
        classCode: route.params?.classCode,
    }), [inviteToken, route.params?.inviteRole, route.params?.department, route.params?.classCode]);

    const form = useFormValidation({
        name: { rules: [validators.required('Please enter your full name')] },
        email: { rules: [validators.required(), validators.email()] },
        matricNo: { rules: [] }, // conditionally validated below
        password: { rules: [validators.required(), validators.minLength(8, 'Password must be at least 8 characters')] },
        confirmPassword: {
            rules: [
                validators.required('Please confirm your password'),
                validators.matches('password', 'Passwords do not match'),
            ],
        },
    });

    const handleContinue = async () => {
        // Add matric rule dynamically for students
        if (role === 'student' && !form.values.matricNo.trim()) {
            form.setError('matricNo', 'Matric number is required for students');
            const { valid } = form.validateAll();
            if (!valid) return;
            return;
        }

        const { valid } = form.validateAll();
        if (!valid) return;

        const result = await startRegistration({
            role,
            name: form.values.name.trim(),
            email: form.values.email.trim(),
            matricNo: role === 'student' ? form.values.matricNo.trim() : undefined,
            password: form.values.password,
            invite: inviteMeta,
        });

        if (!result.ok) {
            Toast.show({ type: 'error', text1: result.message ?? 'Registration failed. Please try again.', position: "bottom" });
            return;
        }

        navigation.navigate('VerifyEmail', { purpose: 'register' });
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
                <Text className="font-heading text-[30px] text-[#181A20]">Create Account</Text>
                <Text className="mt-2 text-[14px] text-[#6B7280]">Use your invite details to join as Lecturer/HOD or Student.</Text>

                <View className="mt-6 flex-row rounded-xl bg-[#EEF2FF] p-1">
                    <Pressable
                        onPress={() => {
                            if (!roleLockedByInvite) setRole('lecturer');
                        }}
                        className="h-11 flex-1 items-center justify-center rounded-lg"
                        style={{ backgroundColor: role === 'lecturer' ? '#4F46E5' : 'transparent' }}
                    >
                        <Text className="font-medium" style={{ color: role === 'lecturer' ? '#fff' : '#374151' }}>Lecturer Portal</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            if (!roleLockedByInvite) setRole('student');
                        }}
                        className="h-11 flex-1 items-center justify-center rounded-lg"
                        style={{ backgroundColor: role === 'student' ? '#4F46E5' : 'transparent' }}
                    >
                        <Text className="font-medium" style={{ color: role === 'student' ? '#fff' : '#374151' }}>Student Portal</Text>
                    </Pressable>
                </View>

                {roleLockedByInvite ? (
                    <Text className="mt-2 text-[12px] text-[#64748B]">
                        Invite-enforced role: {route.params?.inviteRole === 'lecturer' ? 'Lecturer Portal (used for HOD/Lecturer onboarding)' : 'Student Portal'}
                    </Text>
                ) : null}

                <View className="mt-6 gap-4">
                    <ValidatedInput
                        label="Full Name"
                        value={form.values.name}
                        onChangeText={v => form.setValue('name', v)}
                        error={form.errors.name}
                        placeholder="Enter your full name"
                        textContentType="name"
                    />

                    <ValidatedInput
                        label="Email"
                        value={form.values.email}
                        onChangeText={v => form.setValue('email', v)}
                        error={form.errors.email}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder="name@college.edu"
                        textContentType="emailAddress"
                    />

                    {role === 'student' ? (
                        <ValidatedInput
                            label="Matric Number"
                            value={form.values.matricNo}
                            onChangeText={v => form.setValue('matricNo', v)}
                            error={form.errors.matricNo}
                            autoCapitalize="characters"
                            placeholder="e.g. 180404001"
                        />
                    ) : null}

                    <ValidatedInput
                        label="Password"
                        value={form.values.password}
                        onChangeText={v => form.setValue('password', v)}
                        error={form.errors.password}
                        secure
                        placeholder="Minimum 8 characters"
                        textContentType="newPassword"
                    />

                    <ValidatedInput
                        label="Confirm Password"
                        value={form.values.confirmPassword}
                        onChangeText={v => form.setValue('confirmPassword', v)}
                        error={form.errors.confirmPassword}
                        secure
                        placeholder="Re-enter password"
                        textContentType="newPassword"
                    />

                    <View className="rounded-xl bg-[#F8FAFC] p-3">
                        <Text className="text-[12px] text-[#64748B]">Invite token: {inviteToken || 'Not provided (you can still continue for demo flow)'}</Text>
                    </View>
                </View>

                <Pressable
                    onPress={handleContinue}
                    disabled={authLoading}
                    className="mt-8 h-14 items-center justify-center rounded-2xl bg-[#4F46E5]"
                    style={{ opacity: authLoading ? 0.7 : 1 }}
                >
                    <Text className="font-medium text-[16px] text-white">{authLoading ? 'Please wait...' : 'Continue'}</Text>
                </Pressable>

                <View className="mt-6 flex-row items-center justify-center">
                    <Text className="text-[13px] text-[#6B7280]">Already registered?</Text>
                    <Pressable onPress={() => navigation.navigate('Login')}>
                        <Text className="ml-1 text-[13px] font-semibold text-[#4F46E5]">Sign in</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
