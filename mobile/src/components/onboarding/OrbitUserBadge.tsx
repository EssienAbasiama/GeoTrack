import { useEffect, useRef } from "react";
import { Animated, Easing, Image, View } from "react-native";

import type { OrbitUser } from "../../types/onboarding";

type OrbitUserBadgeProps = {
    user: OrbitUser;
    index: number;
};

export function OrbitUserBadge({ user, index }: OrbitUserBadgeProps) {
    const float = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(float, {
                    toValue: 1,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(float, {
                    toValue: 0,
                    duration: 1600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        const delayId = setTimeout(() => animation.start(), index * 130);

        return () => {
            clearTimeout(delayId);
            animation.stop();
        };
    }, [float, index]);

    return (
        <Animated.View
            className={[
                "absolute overflow-hidden rounded-full border-2 border-white shadow-sm shadow-black/10",
                user.frameClassName,
                user.positionClassName,
            ].join(" ")}
            style={{
                transform: [
                    {
                        translateY: float.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -8],
                        }),
                    },
                    {
                        scale: float.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.98, 1.03],
                        }),
                    },
                ],
                opacity: float.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                }),
            }}
        >
            <Image
                source={{ uri: user.imageUrl }}
                resizeMode="cover"
                className="h-full w-full"
            />
        </Animated.View>
    );
}
