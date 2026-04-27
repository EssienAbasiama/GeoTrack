import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthLanding'>;

export function AuthLandingScreen({ navigation }: Props) {
    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9] px-6 pt-6">
            <View className="flex-1">
                <View className="rounded-3xl bg-white p-6 shadow-sm shadow-black/5">
                    <Text className="font-heading text-[30px] text-[#181A20]">GeoTrack Access</Text>
                    <Text className="mt-3 text-[14px] leading-6 text-[#6B7280]">
                        Register through invite link or QR code from your Dean, HOD, Lecturer, or Class admin.
                    </Text>
                </View>

                <View className="mt-6 rounded-2xl bg-[#EEF0FF] p-5">
                    <Text className="font-medium text-[15px] text-[#3B3F4C]">Access Structure</Text>
                    <Text className="mt-2 text-[13px] leading-6 text-[#5B6070]">
                        Dean adds HODs. HODs add Lecturers. Lecturers add HOCs. Students join classes via invite.
                    </Text>
                </View>

                <View className="mt-8 gap-3">
                    <Pressable
                        onPress={() => navigation.navigate('Register')}
                        className="h-14 flex-row items-center justify-center rounded-2xl bg-[#4F46E5]"
                    >
                        <Ionicons name="person-add" size={20} color="#fff" />
                        <Text className="ml-2 font-medium text-[16px] text-white">Create Account</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => navigation.navigate('Login')}
                        className="h-14 flex-row items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white"
                    >
                        <Ionicons name="log-in" size={20} color="#374151" />
                        <Text className="ml-2 font-medium text-[16px] text-[#374151]">Sign In</Text>
                    </Pressable>
                </View>

                <View className="mt-8 rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-4">
                    <Text className="text-[13px] text-[#64748B]">Tip: open invite links directly to pre-fill registration. QR invite maps to the same flow.</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}
