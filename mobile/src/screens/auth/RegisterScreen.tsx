import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../store/AuthContext';
import { ValidatedInput } from '../../components/ValidatedInput';
import useFormValidation, { validators } from '../../hooks/useFormValidation';
import Toast from 'react-native-toast-message';
import { institutionApi } from '../../services/apiClient';
import type { ApiInstitution } from '../../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type RegisterRole = 'student' | 'lecturer';

const PRIMARY = '#4F46E5';

export function RegisterScreen({ navigation, route }: Props) {
    const { startRegistration, authLoading } = useAuth();
    const [role, setRole] = useState<RegisterRole>(route.params?.inviteRole ?? 'student');
    const [step, setStep] = useState<1 | 2>(1);

    // Institution picker state
    const [institutions, setInstitutions]           = useState<ApiInstitution[]>([]);
    const [institutionsLoading, setInstitutionsLoading] = useState(false);
    const [institutionSearch, setInstitutionSearch] = useState('');
    const [selectedInstitution, setSelectedInstitution] = useState<ApiInstitution | null>(null);

    const inviteToken      = route.params?.inviteToken ?? '';
    const roleLockedByInvite = Boolean(route.params?.inviteRole);

    const inviteMeta = useMemo(() => ({
        token: inviteToken || undefined,
        roleHint: route.params?.inviteRole,
        department: route.params?.department,
        classCode: route.params?.classCode,
    }), [inviteToken, route.params?.inviteRole, route.params?.department, route.params?.classCode]);

    const form = useFormValidation({
        name:            { rules: [validators.required('Please enter your full name')] },
        email:           { rules: [validators.required(), validators.email()] },
        matricNo:        { rules: [] },
        password:        { rules: [validators.required(), validators.minLength(8, 'Password must be at least 8 characters')] },
        confirmPassword: {
            rules: [
                validators.required('Please confirm your password'),
                validators.matches('password', 'Passwords do not match'),
            ],
        },
    });

    // Fetch institutions when the user advances to step 2
    useEffect(() => {
        if (step !== 2) return;
        setInstitutionsLoading(true);
        institutionApi.list()
            .then(({ data }) => setInstitutions(data.institutions))
            .catch(() => Toast.show({ type: 'error', text1: 'Could not load institutions.', position: 'bottom' }))
            .finally(() => setInstitutionsLoading(false));
    }, [step]);

    const filteredInstitutions = useMemo(() => {
        const q = institutionSearch.trim().toLowerCase();
        if (!q) return institutions;
        return institutions.filter(
            i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
        );
    }, [institutions, institutionSearch]);

    // ── Step 1: validate personal details, advance to institution picker ──────
    const handleContinue = () => {
        if (role === 'student' && !form.values.matricNo.trim()) {
            form.setError('matricNo', 'Matric number is required for students');
            const { valid } = form.validateAll();
            if (!valid) return;
            return;
        }
        const { valid } = form.validateAll();
        if (!valid) return;
        setStep(2);
    };

    // ── Step 2: submit with selected institution ───────────────────────────────
    const handleSubmit = async () => {
        if (!selectedInstitution) {
            Toast.show({ type: 'error', text1: 'Please select your institution.', position: 'bottom' });
            return;
        }

        const result = await startRegistration({
            role,
            name:          form.values.name.trim(),
            email:         form.values.email.trim(),
            matricNo:      role === 'student' ? form.values.matricNo.trim() : undefined,
            password:      form.values.password,
            institutionId: selectedInstitution.id,
            invite:        inviteMeta,
        });

        if (!result.ok) {
            Toast.show({ type: 'error', text1: result.message ?? 'Registration failed. Please try again.', position: 'bottom' });
            return;
        }

        navigation.navigate('VerifyEmail', { purpose: 'register' });
    };

    // ── Step 1 UI ─────────────────────────────────────────────────────────────
    if (step === 1) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
                    <Text className="font-heading text-[30px] text-[#181A20]">Create Account</Text>
                    <Text className="font-sans mt-2 text-[14px] text-[#6B7280]">
                        Fill in your details to get started.
                    </Text>

                    {/* Role toggle */}
                    <View className="mt-6 flex-row rounded-xl bg-[#EEF2FF] p-1">
                        <Pressable
                            onPress={() => { if (!roleLockedByInvite) setRole('lecturer'); }}
                            className="h-11 flex-1 items-center justify-center rounded-lg"
                            style={{ backgroundColor: role === 'lecturer' ? PRIMARY : 'transparent' }}
                        >
                            <Text style={{ color: role === 'lecturer' ? '#fff' : '#374151', fontFamily: 'WorkSans_500Medium' }}>
                                Lecturer Portal
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => { if (!roleLockedByInvite) setRole('student'); }}
                            className="h-11 flex-1 items-center justify-center rounded-lg"
                            style={{ backgroundColor: role === 'student' ? PRIMARY : 'transparent' }}
                        >
                            <Text style={{ color: role === 'student' ? '#fff' : '#374151', fontFamily: 'WorkSans_500Medium' }}>
                                Student Portal
                            </Text>
                        </Pressable>
                    </View>

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
                        {role === 'student' && (
                            <ValidatedInput
                                label="Matric Number"
                                value={form.values.matricNo}
                                onChangeText={v => form.setValue('matricNo', v)}
                                error={form.errors.matricNo}
                                autoCapitalize="characters"
                                placeholder="e.g. 180404001"
                            />
                        )}
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
                    </View>

                    {/* Step indicator */}
                    <View className="mt-6 flex-row items-center gap-2">
                        <View className="h-2 flex-1 rounded-full bg-[#4F46E5]" />
                        <View className="h-2 flex-1 rounded-full bg-[#E5E7EB]" />
                    </View>
                    <Text className="mt-1 text-[11px] text-[#9CA3AF] text-center">Step 1 of 2 — Personal details</Text>

                    <Pressable
                        onPress={handleContinue}
                        className="mt-6 h-14 items-center justify-center rounded-2xl bg-[#4F46E5]"
                    >
                        <Text style={{ fontFamily: 'WorkSans_500Medium' }} className="text-[16px] text-white">
                            Next — Select Institution
                        </Text>
                    </Pressable>

                    <View className="mt-6 flex-row items-center justify-center">
                        <Text className="font-sans text-[13px] text-[#6B7280]">Already registered?</Text>
                        <Pressable onPress={() => navigation.navigate('Login')}>
                            <Text className="font-heading ml-1 text-[13px] text-[#4F46E5]">Sign in</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── Step 2 UI — Institution picker ────────────────────────────────────────
    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            {/* Header */}
            <View className="flex-row items-center px-6 pt-6 pb-4">
                <Pressable
                    onPress={() => setStep(1)}
                    className="h-9 w-9 items-center justify-center rounded-full bg-[#E8EAF1] mr-3"
                >
                    <Ionicons name="arrow-back" size={18} color="#5A5D6B" />
                </Pressable>
                <View className="flex-1">
                    <Text className="font-heading text-[22px] text-[#181A20]">Select Institution</Text>
                    <Text className="text-[13px] text-[#6B7280] mt-0.5">
                        Choose the institution you belong to
                    </Text>
                </View>
            </View>

            {/* Step indicator */}
            <View className="flex-row items-center gap-2 px-6 mb-4">
                <View className="h-2 flex-1 rounded-full bg-[#4F46E5]" />
                <View className="h-2 flex-1 rounded-full bg-[#4F46E5]" />
            </View>
            <Text className="text-[11px] text-[#9CA3AF] text-center mb-4">Step 2 of 2 — Institution</Text>

            {/* Search */}
            <View className="mx-6 mb-3 flex-row items-center bg-white rounded-[14px] border border-[#E8EAF1] px-4 h-12">
                <Ionicons name="search" size={18} color="#8F94A4" style={{ marginRight: 8 }} />
                <TextInput
                    value={institutionSearch}
                    onChangeText={setInstitutionSearch}
                    placeholder="Search by name or code…"
                    placeholderTextColor="#B8BBC6"
                    style={{ flex: 1, fontSize: 14, color: '#181A20', fontFamily: 'WorkSans_400Regular' }}
                />
                {institutionSearch.length > 0 && (
                    <Pressable onPress={() => setInstitutionSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#B8BBC6" />
                    </Pressable>
                )}
            </View>

            {/* Institution list */}
            {institutionsLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={PRIMARY} />
                    <Text className="mt-3 text-[13px] text-[#8F94A4]">Loading institutions…</Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {filteredInstitutions.length === 0 ? (
                        <View className="items-center py-12">
                            <Ionicons name="business-outline" size={40} color="#D1D5DB" />
                            <Text className="mt-3 text-[15px] text-[#6B7280] text-center">
                                {institutionSearch ? 'No institution matches your search.' : 'No institutions have been set up yet.'}
                            </Text>
                        </View>
                    ) : (
                        filteredInstitutions.map(inst => {
                            const isSelected = selectedInstitution?.id === inst.id;
                            return (
                                <Pressable
                                    key={inst.id}
                                    onPress={() => setSelectedInstitution(inst)}
                                    className="mb-3 rounded-[16px] border-2 bg-white p-4 flex-row items-center"
                                    style={{ borderColor: isSelected ? PRIMARY : '#E8EAF1' }}
                                >
                                    <View
                                        className="h-11 w-11 rounded-[12px] items-center justify-center mr-3"
                                        style={{ backgroundColor: isSelected ? '#EEF2FF' : '#F5F6FA' }}
                                    >
                                        <Ionicons name="business" size={22} color={isSelected ? PRIMARY : '#8F94A4'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text
                                            className="text-[15px] font-medium"
                                            style={{ color: isSelected ? PRIMARY : '#181A20', fontFamily: 'WorkSans_500Medium' }}
                                        >
                                            {inst.name}
                                        </Text>
                                        {inst.address ? (
                                            <Text className="text-[12px] text-[#8F94A4] mt-0.5">{inst.address}</Text>
                                        ) : null}
                                        <View className="mt-1 self-start bg-[#F1F2F6] rounded-full px-2 py-0.5">
                                            <Text className="text-[11px] text-[#5A5D6B]">{inst.code}</Text>
                                        </View>
                                    </View>
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                                    )}
                                </Pressable>
                            );
                        })
                    )}

                    {/* "Not listed" fallback */}
                    <View className="mt-2 rounded-[14px] bg-[#FFF8E1] border border-[#FFE082] p-4 flex-row items-start">
                        <Ionicons name="information-circle-outline" size={18} color="#F59E0B" style={{ marginTop: 1, marginRight: 8 }} />
                        <Text className="flex-1 text-[12px] text-[#92400E] leading-[18px]">
                            Don't see your institution? Ask your institution's super admin to register it on GeoTrack first.
                        </Text>
                    </View>
                </ScrollView>
            )}

            {/* Submit */}
            <View className="px-6 pb-8 pt-3 border-t border-[#E8EAF1] bg-white">
                {selectedInstitution && (
                    <View className="mb-3 flex-row items-center bg-[#EEF2FF] rounded-[12px] px-4 py-3">
                        <Ionicons name="checkmark-circle" size={18} color={PRIMARY} style={{ marginRight: 8 }} />
                        <Text className="text-[13px] text-[#4F46E5] flex-1" style={{ fontFamily: 'WorkSans_500Medium' }}>
                            {selectedInstitution.name}
                        </Text>
                    </View>
                )}
                <Pressable
                    onPress={handleSubmit}
                    disabled={authLoading || !selectedInstitution}
                    className="h-14 items-center justify-center rounded-2xl"
                    style={{
                        backgroundColor: selectedInstitution ? PRIMARY : '#E5E7EB',
                        opacity: authLoading ? 0.7 : 1,
                    }}
                >
                    {authLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text
                            style={{ fontFamily: 'WorkSans_500Medium', color: selectedInstitution ? '#fff' : '#9CA3AF' }}
                            className="text-[16px]"
                        >
                            Create Account
                        </Text>
                    }
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
