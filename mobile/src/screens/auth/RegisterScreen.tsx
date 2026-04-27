import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type RegisterRole = 'student' | 'lecturer';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterScreen({ navigation, route }: Props) {
    const { startRegistration, authLoading } = useAuth();
    const [role, setRole] = useState<RegisterRole>(route.params?.inviteRole ?? 'student');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [matricNo, setMatricNo] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const inviteToken = route.params?.inviteToken ?? '';
    const roleLockedByInvite = Boolean(route.params?.inviteRole);

    const inviteMeta = useMemo(() => ({
        token: inviteToken || undefined,
        roleHint: route.params?.inviteRole,
        department: route.params?.department,
        classCode: route.params?.classCode,
    }), [inviteToken, route.params?.inviteRole, route.params?.department, route.params?.classCode]);

    const handleContinue = async () => {
        if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
            Alert.alert('Incomplete details', 'Please fill all required fields.');
            return;
        }

        if (!emailRegex.test(email.trim())) {
            Alert.alert('Invalid email', 'Enter a valid email address.');
            return;
        }

        if (role === 'student' && !matricNo.trim()) {
            Alert.alert('Missing matric number', 'Students must provide a matric number.');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Weak password', 'Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Password mismatch', 'Passwords do not match.');
            return;
        }

        const result = await startRegistration({
            role,
            name: name.trim(),
            email: email.trim(),
            matricNo: role === 'student' ? matricNo.trim() : undefined,
            password,
            invite: inviteMeta,
        });

        if (!result.ok) {
            Alert.alert('Registration failed', result.message || 'Please try again.');
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
                    <View>
                        <Text className="mb-2 text-[13px] text-[#4B5563]">Full Name</Text>
                        <TextInput value={name} onChangeText={setName} className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]" placeholder="Enter your full name" />
                    </View>

                    <View>
                        <Text className="mb-2 text-[13px] text-[#4B5563]">Email</Text>
                        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]" placeholder="name@college.edu" />
                    </View>

                    {role === 'student' ? (
                        <View>
                            <Text className="mb-2 text-[13px] text-[#4B5563]">Matric Number</Text>
                            <TextInput value={matricNo} onChangeText={setMatricNo} autoCapitalize="characters" className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]" placeholder="e.g. 180404001" />
                        </View>
                    ) : null}

                    <View>
                        <Text className="mb-2 text-[13px] text-[#4B5563]">Password</Text>
                        <TextInput value={password} onChangeText={setPassword} secureTextEntry className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]" placeholder="Minimum 8 characters" />
                    </View>

                    <View>
                        <Text className="mb-2 text-[13px] text-[#4B5563]">Confirm Password</Text>
                        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry className="h-13 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px]" placeholder="Re-enter password" />
                    </View>

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
