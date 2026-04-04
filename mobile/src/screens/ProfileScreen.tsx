import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_COLOR = '#6343cc';

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
}) {
    return (
        <View className="mb-2 flex-row items-center rounded-[14px] bg-[#F5F6FA] px-3 py-3">
            <Ionicons name={icon} size={17} color="#8F94A4" />
            <View className="ml-3 flex-1">
                <Text className="text-[12px] text-[#8F94A4]">{label}</Text>
                <Text className="mt-1 font-medium text-[14px] text-[#232736]">{value}</Text>
            </View>
        </View>
    );
}

export function ProfileScreen() {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const pulseScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseScale, {
                    toValue: 1.1,
                    duration: 260,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseScale, {
                    toValue: 0.96,
                    duration: 180,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(pulseScale, {
                    toValue: 1,
                    speed: 16,
                    bounciness: 10,
                    useNativeDriver: true,
                }),
                Animated.delay(700),
            ])
        );

        pulseLoop.start();
        return () => pulseLoop.stop();
    }, [pulseScale]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 118 }}>
                <View className="mb-4 flex-row items-center justify-between">
                    <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white">
                        <Ionicons name="chevron-back" size={20} color="#232736" />
                    </Pressable>
                    <Text className="font-heading text-[22px] text-[#181A20]">Profile</Text>
                    <View className="h-9 w-9" />
                </View>

                <LinearGradient
                    colors={['#6E5AF7', PRIMARY_COLOR]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 20, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', marginBottom: 14 }}
                >
                    <Image
                        source={{ uri: 'https://randomuser.me/api/portraits/women/8.jpg' }}
                        style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 10 }}
                    />
                    <Text className="font-heading text-[20px] text-[#F8F8FB]">Sarah Johnson</Text>
                    <Text className="mt-1 text-[13px] text-[#D9D9F3]">Student</Text>
                </LinearGradient>

                <View className="mb-4 rounded-[20px] border border-[#E8EAF1] bg-white p-3">
                    <Text className="mb-3 font-heading text-[19px] text-[#1F2230]">Account Information</Text>
                    <InfoRow icon="mail-outline" label="Email" value="sarah@school.edu" />
                    <InfoRow icon="call-outline" label="Phone" value="+1 (555) 987-6547" />
                    <InfoRow icon="business-outline" label="Institution" value="University of Oxford" />
                    <InfoRow icon="shield-checkmark-outline" label="Role" value="Admin" />
                </View>

                <Text className="mb-3 font-heading text-[19px] text-[#1F2230]">Notifications</Text>

                <View className="mb-3 flex-row items-center justify-between rounded-[16px] border border-[#E8EAF1] bg-white px-3 py-3">
                    <View className="mr-2 flex-1 flex-row items-center">
                        <Ionicons name="notifications-outline" size={18} color="#A8ADBB" />
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[15px] text-[#232736]">Push Notification</Text>
                            <Text className="mt-1 text-[12px] text-[#8F94A4]">Receive alerts on your device</Text>
                        </View>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View className="mb-3 flex-row items-center justify-between rounded-[16px] border border-[#E8EAF1] bg-white px-3 py-3">
                    <View className="mr-2 flex-1 flex-row items-center">
                        <MaterialCommunityIcons name="email-outline" size={18} color="#A8ADBB" />
                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[15px] text-[#232736]">Email Notification</Text>
                            <Text className="mt-1 text-[12px] text-[#8F94A4]">Receive updates via email</Text>
                        </View>
                    </View>
                    <Switch
                        value={emailEnabled}
                        onValueChange={setEmailEnabled}
                        trackColor={{ false: '#D6D9E3', true: PRIMARY_COLOR }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            </ScrollView>

            <Animated.View style={{ position: 'absolute', right: 20, bottom: 100, transform: [{ scale: pulseScale }] }}>
                <Pressable className="h-14 w-14 items-center justify-center rounded-2xl bg-[#6343cc] shadow-lg shadow-[#4A34D7]/30">
                    <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    );
}
