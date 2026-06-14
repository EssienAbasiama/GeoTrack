import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, Text, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const PRIMARY = '#6343cc';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Topic {
    q: string;
    a: string;
}

interface Section {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    bg: string;
    topics: Topic[];
}

const SECTIONS: Section[] = [
    {
        title: 'Getting started',
        icon: 'rocket-outline',
        color: '#6343cc',
        bg: '#F0EDFC',
        topics: [
            { q: 'What is GeoTrack?', a: 'GeoTrack is a location- and face-verified attendance system. Students check in to class from inside the venue, and the app confirms both their position (geofence) and identity (face) so attendance is genuine.' },
            { q: 'How do I sign in?', a: 'Use the email (or matric number) and password from your registration. Your account is bound to one device for security — if you change phones, use “Reset device” in Profile.' },
            { q: 'Why does it ask for my location and camera?', a: 'Location confirms you are physically at the class venue, and the camera captures a quick selfie to verify it is really you checking in. Both are only used at check-in.' },
        ],
    },
    {
        title: 'For students',
        icon: 'school-outline',
        color: '#2196F3',
        bg: '#E3F2FD',
        topics: [
            { q: 'How do I check in to a class?', a: 'When a class is live, open it (or use the Home button) and tap “Verify face & check in”. You must be inside the venue boundary and have enrolled your face once. The app records you as Present or Late based on the time.' },
            { q: 'How do I enroll my face?', a: 'Go to Profile → Face profile, or you will be prompted the first time you check in. Take one clear selfie; this becomes your reference for every future check-in.' },
            { q: 'I’m getting “You are not within the class venue”.', a: 'You are outside the geofence. Move closer to the venue centre — the check-in map shows your distance. GPS can be off indoors, so stand near a window or door if needed.' },
            { q: 'Where do I see my attendance?', a: 'The Calendar tab shows your classes by day, and each class detail shows your attendance history and rate.' },
        ],
    },
    {
        title: 'For lecturers',
        icon: 'person-outline',
        color: '#0EA5A0',
        bg: '#E0F2F1',
        topics: [
            { q: 'How does attendance open?', a: 'A session opens automatically when the class reaches its scheduled day and time. Students can then check in. You can also start/stop attendance from the class detail screen.' },
            { q: 'Can I set or change the class location?', a: 'Yes. Open the class → ⋮ menu → Edit Location to pick an existing venue or draw a GPS boundary. You can also edit the class schedule and details.' },
            { q: 'How do I add students?', a: 'Open the class and use Add Student, or share a join link (⋮ → Share with Students). Students in your institution who tap the link join instantly.' },
        ],
    },
    {
        title: 'For HOC & HOD',
        icon: 'shield-checkmark-outline',
        color: '#FF9800',
        bg: '#FFF3E0',
        topics: [
            { q: 'What can an HOC do?', a: 'A Head of Class oversees their class: set the venue/boundary, add students, share invite links, and edit class details like day and time.' },
            { q: 'What can an HOD (Super Admin) do?', a: 'The HOD manages the whole institution: create classes and lecturers, assign or change a class’s lecturer, edit any class, and delete classes.' },
            { q: 'How do I assign a lecturer to a class?', a: 'Open the class detail. If no lecturer is set, tap “Assign a lecturer”; if one is set, tap the edit icon next to them. You can also share a lecturer invite link.' },
        ],
    },
    {
        title: 'Notifications',
        icon: 'notifications-outline',
        color: '#E11D48',
        bg: '#FFE4E6',
        topics: [
            { q: 'Will I be reminded before class?', a: 'Yes. Shortly before a class starts, GeoTrack sends a push notification (and email) to enrolled students and the lecturer so no one misses check-in.' },
            { q: 'How do I turn notifications on or off?', a: 'Go to Profile → Notifications and toggle Push or Email. Your choice is saved to your account and respected for every reminder.' },
        ],
    },
    {
        title: 'Security & devices',
        icon: 'lock-closed-outline',
        color: '#7C3AED',
        bg: '#F3E8FF',
        topics: [
            { q: 'Why is my account tied to one device?', a: 'Device binding stops someone checking in for you from another phone. Each account is bound to a single device.' },
            { q: 'I changed my phone — what now?', a: 'On your new phone, sign in and use Profile → Reset device to bind the new one. The old device is unbound.' },
            { q: 'How do I change my password?', a: 'Profile → Password Manager. Enter your current password and a new one; this also signs out your other sessions.' },
        ],
    },
];

function TopicRow({ topic }: { topic: Topic }) {
    const [open, setOpen] = useState(false);
    return (
        <View className="border-b border-[#F1F2F6]">
            <Pressable
                onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setOpen((o) => !o);
                }}
                className="flex-row items-center py-3.5 active:opacity-70"
            >
                <Text className="flex-1 font-medium text-[14px] text-[#232736] pr-3">{topic.q}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#8F94A4" />
            </Pressable>
            {open && (
                <Text className="text-[13px] text-[#5A5D6B] leading-[20px] pb-3.5">{topic.a}</Text>
            )}
        </View>
    );
}

export function HelpCenterScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="px-5 pt-3 pb-2 flex-row items-center">
                <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5 mr-3">
                    <Ionicons name="arrow-back" size={20} color="#181A20" />
                </Pressable>
                <Text className="font-heading text-[20px] text-[#181A20]">Help Center</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View className="rounded-[18px] bg-[#6343cc] p-5 mb-5">
                    <Text className="font-heading text-[18px] text-white">How GeoTrack works</Text>
                    <Text className="text-[13px] text-white/85 mt-2 leading-[20px]">
                        Attendance is proven two ways: you must be inside the class venue (GPS geofence) and verify your face. Find answers for your role below.
                    </Text>
                </View>

                {SECTIONS.map((section) => (
                    <View key={section.title} className="mb-4 rounded-[16px] bg-white border border-[#EFEFF3] px-4 pt-1">
                        <View className="flex-row items-center py-3">
                            <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: section.bg }}>
                                <Ionicons name={section.icon} size={18} color={section.color} />
                            </View>
                            <Text className="ml-3 font-heading text-[15px] text-[#181A20]">{section.title}</Text>
                        </View>
                        {section.topics.map((t) => (
                            <TopicRow key={t.q} topic={t} />
                        ))}
                    </View>
                ))}

                <Text className="text-[12px] text-[#9CA3AF] text-center mt-2">
                    Still need help? Contact your institution’s GeoTrack administrator.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
