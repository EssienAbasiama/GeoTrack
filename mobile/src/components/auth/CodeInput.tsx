import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

interface CodeInputProps {
    length?: number;
    value: string;
    onChange: (next: string) => void;
}

export function CodeInput({ length = 6, value, onChange }: CodeInputProps) {
    const hiddenInputRef = useRef<TextInput>(null);

    useEffect(() => {
        hiddenInputRef.current?.focus();
    }, []);

    const digits = useMemo(
        () => Array.from({ length }, (_, index) => value[index] ?? ''),
        [length, value]
    );

    const handleChangeText = (text: string) => {
        const sanitized = text.replace(/[^0-9]/g, '').slice(0, length);
        onChange(sanitized);
    };

    return (
        <Pressable
            onPress={() => hiddenInputRef.current?.focus()}
            className="w-full"
        >
            <TextInput
                ref={hiddenInputRef}
                value={value}
                onChangeText={handleChangeText}
                keyboardType="number-pad"
                maxLength={length}
                className="absolute h-0 w-0 opacity-0"
            />
            <View className="flex-row items-center justify-between">
                {digits.map((digit, index) => {
                    const active = index === value.length;
                    return (
                        <View
                            key={index}
                            className="h-14 w-12 items-center justify-center rounded-xl border"
                            style={{
                                borderColor: active ? '#6343cc' : '#E5E7EB',
                                backgroundColor: '#FFFFFF',
                            }}
                        >
                            <View className="h-7 justify-center">
                                {digit ? (
                                    <View className="h-2.5 w-2.5 rounded-full bg-[#181A20]" />
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </View>
        </Pressable>
    );
}
