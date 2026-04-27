import React, { useEffect, useRef, useState } from 'react';
import {
    Pressable,
    Text,
    TextInput,
    TextInputProps,
    Vibration,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { errorFeedback } from '../utils/haptics';

interface ValidatedInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
    /** Label rendered above the input. */
    label?: string;
    /** Current error message; triggers shake + haptic when it first appears. */
    error?: string;
    /**
     * Turns the input into a password field with a show/hide eye toggle.
     * Replaces `secureTextEntry` so you don't set that manually.
     */
    secure?: boolean;
    /** Extra style/layout class on the outer wrapper View. */
    containerClassName?: string;
}

// ─── Shake duration constants (ms) ───────────────────────────────────────────
const T = 50; // step duration
const SHAKE = [
    [-10, T], [10, T], [-8, T], [8, T], [-4, T], [0, T + 10],
] as const;

const AnimatedView = Animated.createAnimatedComponent(View);

/**
 * Drop-in replacement for a labelled TextInput that adds:
 *  - Inline error message below the input
 *  - Red border + tinted background when `error` is set
 *  - Indigo border when focused
 *  - Horizontal shake animation when error first appears (or re-appears)
 *  - Haptic + Vibration feedback on error
 *  - Optional show/hide toggle for `secure` (password) fields
 */
export function ValidatedInput({
    label,
    error,
    secure = false,
    containerClassName,
    onFocus,
    onBlur,
    style,
    ...rest
}: ValidatedInputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [showText, setShowText] = useState(false); // false = text hidden (for secure fields)

    // ── Shake animation ───────────────────────────────────────────────────────
    const translateX = useSharedValue(0);
    const prevErrorRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        const hadError = Boolean(prevErrorRef.current);
        const hasError = Boolean(error);

        // Trigger only when error newly appears (falsy → truthy)
        if (hasError && !hadError) {
            // Haptic feedback (notification-error pattern on iOS, notification on Android)
            errorFeedback();

            // Physical vibration pattern: pause → 60ms → pause → 60ms
            Vibration.vibrate([0, 60, 40, 60]);

            // Reanimated horizontal shake
            translateX.value = withSequence(
                ...SHAKE.map(([to, dur]) => withTiming(to, { duration: dur })),
            );
        }

        prevErrorRef.current = error;
    }, [error, translateX]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    // ── Derived border & background colours ───────────────────────────────────
    const borderColor = error ? '#EF4444' : isFocused ? '#4F46E5' : '#E5E7EB';
    const backgroundColor = error ? '#FFF5F5' : '#FFFFFF';

    return (
        <View className={containerClassName}>
            {label ? (
                <Text className="mb-2 text-[13px] text-[#4B5563]">{label}</Text>
            ) : null}

            <AnimatedView style={animatedStyle}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 52,
                        borderWidth: 1,
                        borderRadius: 12,
                        borderColor,
                        backgroundColor,
                        paddingHorizontal: 16,
                    }}
                >
                    <TextInput
                        {...rest}
                        secureTextEntry={secure && !showText}
                        onFocus={(e) => {
                            setIsFocused(true);
                            onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            onBlur?.(e);
                        }}
                        style={[
                            {
                                flex: 1,
                                fontSize: 15,
                                color: '#111827',
                                padding: 0, // override RN default vertical padding on Android
                            },
                            style,
                        ]}
                        placeholderTextColor="#9CA3AF"
                    />

                    {secure ? (
                        <Pressable
                            onPress={() => setShowText(v => !v)}
                            hitSlop={8}
                            accessibilityLabel={showText ? 'Hide password' : 'Show password'}
                        >
                            <Ionicons
                                name={showText ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color="#9CA3AF"
                            />
                        </Pressable>
                    ) : null}
                </View>
            </AnimatedView>

            {error ? (
                <Text
                    style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}
                    numberOfLines={2}
                >
                    {error}
                </Text>
            ) : null}
        </View>
    );
}
