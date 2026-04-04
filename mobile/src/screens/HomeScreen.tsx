import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View, Easing } from "react-native";
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

    // --- Screen fade animation ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    // --- Ripple Animations ---
    const rippleCount = 4;
    const rippleAnims = useRef(
        Array.from({ length: rippleCount }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        rippleAnims.forEach((anim, index) => {
            const animate = () => {
                Animated.sequence([
                    Animated.delay(index * 500), // stagger start for each ripple
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 2500,
                        easing: Easing.out(Easing.exp),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]).start(() => animate()); // repeat infinitely
            };
            animate();
        });
    }, []);

    const rippleStyle = (animatedValue, size) => ({
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#6755f2',
        opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 0],
        }),
        transform: [
            {
                scale: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1.8],
                }),
            },
        ],
    });

    const buttonScale = useRef(new Animated.Value(1)).current;
    const [checkedIn, setCheckedIn] = useState(false);

    const handlePress = () => {
        Animated.sequence([
            Animated.timing(buttonScale, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(buttonScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => setCheckedIn(prev => !prev));
    };

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
                    {/* Header */}
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

                    {/* Date & Time */}
                    <View className="mt-8 items-center">
                        <Text className="font-medium text-[14px] text-[#4A4C55]">{formattedDate}</Text>
                        <Text className="mt-2 font-bold text-[42px] leading-[48px] text-[#17181D]">{formattedTime}</Text>
                    </View>

                    {/* Check-in Stats */}
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

                    {/* Lunch */}
                    <View className="mt-4 flex-row items-center rounded-[16px] bg-white px-3 py-4 shadow-sm shadow-black/5">
                        <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#2AB64D]">
                            <MaterialCommunityIcons name="food-apple-outline" size={18} color="#FFFFFF" />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="font-bold text-[14px] leading-[14px] text-[#7F8291]">ELE 512</Text>

                        </View>
                        <Text className="font-heading text-[20px] leading-[30px] text-[#31A74A]">Start</Text>
                        <Text className="ml-6 font-heading text-[20px] leading-[24px] text-[#6A9E6F]">00:00m</Text>
                    </View>

                    {/* Clock In Button with smooth multiple ripples */}
                    <View className="mt-10 items-center">
                        <View className="relative h-[278px] w-[278px] items-center justify-center">
                            {rippleAnims.map((anim, idx) => (
                                <Animated.View
                                    key={idx}
                                    style={rippleStyle(anim, 130 + idx * 30)}
                                />
                            ))}

                            <Pressable onPress={handlePress}>
                                <Animated.View
                                    style={{
                                        width: 130,
                                        height: 130,
                                        borderRadius: 65,
                                        backgroundColor: '#6343cc',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        transform: [{ scale: buttonScale }],
                                    }}
                                >
                                    <FontAwesome5 name={checkedIn ? 'hand-paper' : 'hand-pointer'} size={28} color="#fff" />
                                    <Text className="mt-2 font-heading text-[16px] text-white">
                                        {checkedIn ? 'Checked In' : 'Check In'}
                                    </Text>
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}