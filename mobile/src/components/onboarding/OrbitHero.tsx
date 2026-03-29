import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Text, View } from "react-native";

import { orbitUsers } from "../../constants/onboarding";
import { OrbitUserBadge } from "./OrbitUserBadge";

const logoSource = require("../../../assets/Images/Logo.png");

export function OrbitHero() {
    const reveal = useRef(new Animated.Value(0)).current;
    const ambient = useRef(new Animated.Value(0)).current;
    const ringRotate = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(reveal, {
            toValue: 1,
            duration: 760,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        const ambientLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(ambient, {
                    toValue: 1,
                    duration: 2600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(ambient, {
                    toValue: 0,
                    duration: 2600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        const rotateLoop = Animated.loop(
            Animated.timing(ringRotate, {
                toValue: 1,
                duration: 18000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 1200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        ambientLoop.start();
        rotateLoop.start();
        pulseLoop.start();

        return () => {
            ambientLoop.stop();
            rotateLoop.stop();
            pulseLoop.stop();
        };
    }, [ambient, pulse, reveal, ringRotate]);

    return (
        <View className="relative flex-1 items-center justify-center px-2">
            <Animated.View
                className="absolute left-[-56px] top-20 h-56 w-56 rounded-full bg-[#7A63FF]/14"
                style={{
                    transform: [
                        {
                            translateX: ambient.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 12],
                            }),
                        },
                        {
                            translateY: ambient.interpolate({
                                inputRange: [0, 1],
                                outputRange: [8, -10],
                            }),
                        },
                    ],
                }}
            />
            <Animated.View
                className="absolute right-[-72px] top-14 h-64 w-64 rounded-full bg-[#8D79FF]/12"
                style={{
                    transform: [
                        {
                            translateX: ambient.interpolate({
                                inputRange: [0, 1],
                                outputRange: [10, -12],
                            }),
                        },
                        {
                            translateY: ambient.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-10, 12],
                            }),
                        },
                    ],
                }}
            />

            <Animated.View
                className="mb-8 items-center"
                style={{
                    opacity: reveal,
                    transform: [
                        {
                            translateY: reveal.interpolate({
                                inputRange: [0, 1],
                                outputRange: [12, 0],
                            }),
                        },
                    ],
                }}
            >
                <Text className="font-medium text-[32px] leading-[38px] text-[#4A5061]">GeoTrack</Text>
            </Animated.View>

            <Animated.View
                className="relative h-[360px] w-full items-center justify-center"
                style={{
                    opacity: reveal,
                    transform: [
                        {
                            scale: reveal.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.94, 1],
                            }),
                        },
                    ],
                }}
            >
                <Animated.View
                    className="absolute h-[320px] w-[320px] rounded-full border border-[#E7E8EE]"
                    style={{
                        transform: [
                            {
                                rotate: ringRotate.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ["0deg", "360deg"],
                                }),
                            },
                        ],
                    }}
                />
                <Animated.View
                    className="absolute h-[252px] w-[252px] rounded-full border border-[#E7E8EE]"
                    style={{
                        transform: [
                            {
                                rotate: ringRotate.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ["0deg", "-260deg"],
                                }),
                            },
                        ],
                    }}
                />
                <View className="absolute h-[180px] w-[180px] rounded-full border border-[#E7E8EE]" />
                <View className="absolute h-[170px] w-[170px] rounded-full bg-[#6A4DF6]/55" />

                <Animated.View
                    className="h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-[#5B3DF5] shadow-lg shadow-[#4A34D7]/30"
                    style={{
                        transform: [
                            {
                                scale: pulse.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.98, 1.03],
                                }),
                            },
                        ],
                    }}
                >
                    <Image source={logoSource} resizeMode="contain" className="h-full w-full" />
                </Animated.View>

                {orbitUsers.map((user, index) => (
                    <OrbitUserBadge key={user.id} user={user} index={index} />
                ))}
            </Animated.View>
        </View>
    );
}
