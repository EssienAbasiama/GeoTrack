import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Text, View } from "react-native";

const logoSource = require("../../assets/Images/Logo.png");

type SplashScreenProps = {
    onFinish: () => void;
};

export function SplashScreen({ onFinish }: SplashScreenProps) {
    const scale = useRef(new Animated.Value(0.88)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 1,
                duration: 650,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.loop(
                Animated.sequence([
                    Animated.parallel([
                        Animated.timing(scale, {
                            toValue: 1.08,
                            duration: 680,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(translateY, {
                            toValue: -10,
                            duration: 680,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(glow, {
                            toValue: 0.7,
                            duration: 680,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: false,
                        }),
                    ]),
                    Animated.parallel([
                        Animated.spring(scale, {
                            toValue: 0.98,
                            damping: 8,
                            stiffness: 120,
                            mass: 0.9,
                            useNativeDriver: true,
                        }),
                        Animated.spring(translateY, {
                            toValue: 0,
                            damping: 8,
                            stiffness: 120,
                            mass: 0.9,
                            useNativeDriver: true,
                        }),
                        Animated.timing(glow, {
                            toValue: 0.4,
                            duration: 620,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: false,
                        }),
                    ]),
                ])
            ),
        ]).start();

        const timeoutId = setTimeout(onFinish, 2200);
        return () => clearTimeout(timeoutId);
    }, [fade, glow, onFinish, scale, translateY]);

    return (
        <View className="flex-1 items-center justify-center bg-[#6343cc]">
            <Animated.View
                className="absolute h-64 w-64 rounded-full bg-white/10"
                style={{
                    opacity: glow,
                    transform: [{ scale: glow.interpolate({ inputRange: [0.35, 0.7], outputRange: [0.88, 1.18] }) }],
                }}
            />

            <Animated.View
                style={{
                    opacity: fade,
                    transform: [{ translateY }, { scale }],
                }}
                className="items-center"
            >
                <Image source={logoSource} resizeMode="contain" className="h-28 w-28" />
                <Text className="mt-5 font-medium text-[18px] tracking-[0.5px] text-white/90">GeoTrack</Text>
            </Animated.View>

            <StatusBar style="light" />
        </View>
    );
}
