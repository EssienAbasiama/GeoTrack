import { Ionicons } from '@expo/vector-icons';
import { Animated, Dimensions, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';

interface LogoutBottomSheetProps {
    isVisible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = 280;

export function LogoutBottomSheet({ isVisible, onCancel, onConfirm }: LogoutBottomSheetProps) {
    const closedOffset = SHEET_HEIGHT + 40;
    const openOffset = 0;
    const slideAnim = useRef(new Animated.Value(closedOffset)).current;
    const dragStartOffset = useRef(0);
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 6,
            onPanResponderGrant: () => {
                slideAnim.stopAnimation((value) => {
                    dragStartOffset.current = value;
                });
            },
            onPanResponderMove: (_evt, gestureState) => {
                const nextOffset = Math.min(
                    Math.max(dragStartOffset.current + gestureState.dy, openOffset),
                    closedOffset
                );
                slideAnim.setValue(nextOffset);
            },
            onPanResponderRelease: (_evt, gestureState) => {
                const dragDistance = dragStartOffset.current + gestureState.dy;
                const shouldClose = dragDistance > 110 || gestureState.vy > 1;

                if (shouldClose) {
                    onCancel();
                    return;
                }

                Animated.spring(slideAnim, {
                    toValue: openOffset,
                    speed: 14,
                    bounciness: 6,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    useEffect(() => {
        if (isVisible) {
            Animated.spring(slideAnim, {
                toValue: openOffset,
                speed: 12,
                bounciness: 5,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: closedOffset,
                duration: 240,
                useNativeDriver: true,
            }).start();
        }
    }, [closedOffset, isVisible, openOffset, slideAnim]);

    return (
        <Modal visible={isVisible} transparent animationType="none">
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <Pressable onPress={onCancel} className="absolute inset-0" />
                <Animated.View
                    style={{
                        height: SHEET_HEIGHT,
                        transform: [{ translateY: slideAnim }],
                    }}
                    className="bg-white rounded-t-[28px] px-5 py-6"
                >
                    <View className="items-center pb-3" {...panResponder.panHandlers}>
                        <View className="h-[5px] w-14 rounded-full bg-[#D7DBE6]" />
                    </View>

                    <Pressable onPress={onCancel} className="absolute top-4 right-4 z-10">
                        <Ionicons name="close" size={24} color="#232736" />
                    </Pressable>

                    <View className="items-center mb-6 mt-4">
                        <Text className="font-heading text-[24px] text-[#6343cc] mb-4">Logout</Text>
                        <Text className="font-heading text-[18px] text-[#181A20] text-center mb-3">
                            Are you sure want to Logout?
                        </Text>
                        <Text className="text-[15px] text-[#8F94A4] text-center leading-6">
                            Thank you and see you again 💚
                        </Text>
                    </View>

                    <View className="mt-4 flex-row gap-3">
                        <Pressable
                            onPress={onCancel}
                            className="flex-1 py-4 rounded-[14px] border border-[#E8EAF1] bg-white items-center justify-center"
                        >
                            <Text className="font-medium text-[16px] text-[#232736]">Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={onConfirm}
                            className="flex-1 py-4 rounded-[14px] bg-[#6343cc] items-center justify-center"
                        >
                            <Text className="font-medium text-[16px] text-white">Yes, Logout</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
