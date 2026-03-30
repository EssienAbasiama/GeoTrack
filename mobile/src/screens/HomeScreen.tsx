import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const avatarSource = { uri: "https://randomuser.me/api/portraits/men/32.jpg" };

function useLiveClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return now;
}


export function HomeScreen() {
    const now = useLiveClock();
    const waveA = useRef(new Animated.Value(0)).current;
    const waveB = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const rippleScale = useRef(new Animated.Value(0.6)).current;
    const rippleOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        waveA.setValue(0);
        waveB.setValue(0);

        const pulseA = Animated.loop(
            Animated.sequence([
                Animated.timing(waveA, {
                    toValue: 1,
                    duration: 2200,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(waveA, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        const pulseB = Animated.loop(
            Animated.sequence([
                Animated.delay(1050),
                Animated.timing(waveB, {
                    toValue: 1,
                    duration: 2200,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(waveB, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        );

        pulseA.start();
        pulseB.start();

        return () => {
            pulseA.stop();
            pulseB.stop();
        };
    }, [waveA, waveB]);

    const formattedDate = useMemo(
        () =>
            now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                weekday: "long",
            }),
        [now]
    );

    const formattedTime = useMemo(
        () =>
            now.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
            }),
        [now]
    );

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <SafeAreaView className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <Animated.View
                style={{
                    flex: 1,
                    opacity: fadeAnim,
                    transform: [
                        {
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                            }),
                        },
                    ],
                }}
            >
                <View className="flex-1 pb-[132px]">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Image source={avatarSource} className="h-12 w-12 rounded-full" resizeMode="cover" />
                            <View className="ml-3">
                                <Text className="font-sans text-[11px] text-[#A4A7B3]">Welcome back,</Text>
                                <Text className="font-heading text-[18px] leading-[20px] text-[#2D2F35]">Essien Abasiama</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center gap-4">
                            <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-[#EEEAFD]">
                                <Ionicons name="notifications" size={16} color="#6343cc" />
                            </Pressable>
                            <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F6]">
                                <Feather name="menu" size={16} color="#8F93A3" />
                            </Pressable>
                        </View>
                    </View>

                    <View className="mt-8 items-center">
                        <Text className="font-medium text-[14px] text-[#4A4C55]">{formattedDate}</Text>
                        <Text className="mt-2 font-bold text-[42px] leading-[48px] text-[#17181D]">{formattedTime}</Text>
                    </View>

                    <View className="mt-5 rounded-[20px] border border-[#ECECF2] bg-[#F9F9FB] px-4 py-6">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 items-center">
                                <Text className="font-sans text-[10px] text-[#C1C4CE]">Check in</Text>
                                <Text className="mt-1 font-medium text-[14px] text-[#7E818D]">-- : --</Text>
                            </View>
                            <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                            <View className="flex-1 items-center">
                                <Text className="font-sans text-[10px] text-[#C1C4CE]">Check Out</Text>
                                <Text className="mt-1 font-medium text-[14px] text-[#7E818D]">-- : --</Text>
                            </View>
                            <View className="h-9 w-[1px] bg-[#E7E8EE]" />
                            <View className="flex-1 items-center">
                                <Text className="font-sans text-[10px] text-[#C1C4CE]">Total hour</Text>
                                <Text className="mt-1 font-heading text-[18px] text-[#2E3036]">00:00h</Text>
                            </View>
                        </View>
                    </View>

                    <View className="mt-4 flex-row items-center rounded-[16px] bg-white px-3 py-4 shadow-sm shadow-black/5">
                        <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#2AB64D]">
                            <MaterialCommunityIcons name="food-apple-outline" size={18} color="#FFFFFF" />
                        </View>

                        <View className="ml-3 flex-1">
                            <Text className="font-medium text-[11px] leading-[14px] text-[#7F8291]">Lunch</Text>
                            <Text className="font-medium text-[11px] leading-[14px] text-[#7F8291]">Break</Text>
                        </View>

                        <Text className="font-heading text-[14px] leading-[30px] text-[#31A74A]">Start</Text>
                        <Text className="ml-6 font-heading text-[20px] leading-[24px] text-[#6A9E6F]">00:00m</Text>
                    </View>

                    <View className="mt-10 items-center">
                        <View className="relative h-[278px] w-[278px] items-center justify-center">
                            {/* Animated ripples only, no static circles */}
                            <Animated.View
                                pointerEvents="none"
                                className="absolute h-[278px] w-[278px] rounded-full bg-[#ECE9FA]"
                                style={{
                                    opacity: waveA.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.44, 0],
                                    }),
                                    transform: [
                                        {
                                            scale: waveA.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.2],
                                            }),
                                        },
                                    ],
                                }}
                            />
                            <Animated.View
                                pointerEvents="none"
                                className="absolute h-[198px] w-[198px] rounded-full bg-[#DAD2F5]"
                                style={{
                                    opacity: waveB.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.5, 0],
                                    }),
                                    transform: [
                                        {
                                            scale: waveB.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.25],
                                            }),
                                        },
                                    ],
                                }}
                            />
                            <View className="h-[278px] w-[278px] items-center justify-center rounded-full">
                                <View className="h-[198px] w-[198px] items-center justify-center rounded-full">
                                    <Pressable
                                        onPressIn={() => {
                                            Animated.spring(buttonScale, {
                                                toValue: 0.94,
                                                useNativeDriver: true,
                                            }).start();
                                            Animated.parallel([
                                                Animated.timing(rippleScale, {
                                                    toValue: 1.4,
                                                    duration: 180,
                                                    useNativeDriver: true,
                                                }),
                                                Animated.timing(rippleOpacity, {
                                                    toValue: 0.28,
                                                    duration: 180,
                                                    useNativeDriver: true,
                                                }),
                                            ]).start();
                                        }}
                                        onPressOut={() => {
                                            Animated.spring(buttonScale, {
                                                toValue: 1,
                                                friction: 4,
                                                useNativeDriver: true,
                                            }).start();
                                            Animated.timing(rippleOpacity, {
                                                toValue: 0,
                                                duration: 220,
                                                useNativeDriver: true,
                                            }).start(() => {
                                                rippleScale.setValue(0.6);
                                            });
                                        }}
                                        onPress={() => {
                                            Animated.sequence([
                                                Animated.timing(rippleScale, {
                                                    toValue: 1.7,
                                                    duration: 260,
                                                    useNativeDriver: true,
                                                }),
                                                Animated.timing(rippleScale, {
                                                    toValue: 0.6,
                                                    duration: 0,
                                                    useNativeDriver: true,
                                                }),
                                            ]).start();
                                        }}
                                        className="h-[126px] w-[126px] items-center justify-center"
                                    >
                                        <Animated.View
                                            className="absolute h-[126px] w-[126px] rounded-full bg-white"
                                            style={{
                                                opacity: rippleOpacity,
                                                transform: [{ scale: rippleScale }],
                                            }}
                                        />

                                        <Animated.View
                                            className="h-[126px] w-[126px] items-center justify-center rounded-full border border-white/35"
                                            style={{
                                                transform: [{ scale: buttonScale }],
                                                backgroundColor: 'rgba(99, 67, 204, 0.22)',
                                            }}
                                        >
                                            <View className="h-[72px] w-[72px] rounded-full items-center justify-center bg-[#6343cc]/60 border border-white/45">
                                                <MaterialCommunityIcons name="gesture-tap-button" size={28} color="#FFFFFF" />
                                            </View>
                                            <Text className="mt-2 font-heading text-[16px] text-white">Check In</Text>
                                        </Animated.View>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}
