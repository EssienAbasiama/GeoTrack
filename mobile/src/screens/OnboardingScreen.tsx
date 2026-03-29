import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OrbitHero } from "../components/onboarding/OrbitHero";

type OnboardingScreenProps = {
    onGetStarted: () => void;
};

export function OnboardingScreen({ onGetStarted }: OnboardingScreenProps) {
    return (
        <SafeAreaView className="flex-1 bg-[#F5F4F8] px-6">
            <OrbitHero />

            <View className="pb-7">
                <Text className="mt-2 text-center font-bold text-[42px] leading-[46px] text-[#181A22]">
                    Smarter way to attend
                </Text>
                <Text className="mt-3 px-5 text-center font-sans text-[15px] leading-[22px] text-[#8C93A4]">
                    Mark attendance in just two steps. Scan your location, verify with your QR code, and move on.
                </Text>

                <Pressable
                    onPress={onGetStarted}
                    className="mt-6 h-14 items-center justify-center rounded-2xl bg-[#5B3DF5] shadow-lg shadow-[#4A34D7]/25 active:opacity-90"
                >
                    <Text className="font-heading text-[18px] leading-[22px] text-white">Get started</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
