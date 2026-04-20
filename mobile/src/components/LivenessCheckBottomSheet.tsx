import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Pressable,
    Text,
    View,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
    celebrationPattern,
    errorFeedback,
    lightImpact,
    mediumImpact,
    successFeedback,
    selectionFeedback
} from '../utils/haptics';

const PRIMARY_COLOR = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type LivenessStep = 'intro' | 'capturing' | 'verifying' | 'success' | 'failed';
type FaceChallenge = 'center' | 'smile' | 'blink' | 'turn_left' | 'turn_right';

export interface LivenessCheckBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface LivenessCheckBottomSheetProps {
    onSuccess: () => void;
    onCancel?: () => void;
    studentName?: string;
    classCode?: string;
}

const CHALLENGE_INSTRUCTIONS: Record<FaceChallenge, { icon: string; text: string }> = {
    center: { icon: 'face-recognition', text: 'Position your face in the center' },
    smile: { icon: 'emoticon-happy-outline', text: 'Now smile!' },
    blink: { icon: 'eye-off-outline', text: 'Blink your eyes' },
    turn_left: { icon: 'head-side-outline', text: 'Turn your head left' },
    turn_right: { icon: 'head-side-outline', text: 'Turn your head right' },
};

export const LivenessCheckBottomSheet = forwardRef<LivenessCheckBottomSheetRef, LivenessCheckBottomSheetProps>(
    ({ onSuccess, onCancel, studentName, classCode }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();
        const [permission, requestPermission] = useCameraPermissions();

        const [step, setStep] = useState<LivenessStep>('intro');
        const [currentChallenge, setCurrentChallenge] = useState<FaceChallenge>('center');
        const [challengeProgress, setChallengeProgress] = useState(0);
        const [challengesPassed, setChallengesPassed] = useState(0);

        // Animations
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const progressAnim = useRef(new Animated.Value(0)).current;
        const ringAnim = useRef(new Animated.Value(0)).current;
        const fadeAnim = useRef(new Animated.Value(0)).current;
        const scaleAnim = useRef(new Animated.Value(0.8)).current;
        const successAnim = useRef(new Animated.Value(0)).current;
        const bounceAnim = useRef(new Animated.Value(0)).current;

        const snapPoints = useMemo(() => ['92%'], []);

        const challenges: FaceChallenge[] = ['center', 'smile', 'blink'];
        const totalChallenges = challenges.length;

        useImperativeHandle(ref, () => ({
            open: () => {
                setStep('intro');
                setChallengesPassed(0);
                setCurrentChallenge('center');
                setChallengeProgress(0);
                progressAnim.setValue(0);
                ringAnim.setValue(0);
                successAnim.setValue(0);
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        // Pulse animation for scan ring
        useEffect(() => {
            if (step === 'capturing') {
                const pulse = Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.1,
                            duration: 1000,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 1000,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulse.start();

                // Ring animation
                Animated.timing(ringAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: false,
                }).start();

                return () => pulse.stop();
            }
        }, [step]);

        // Intro animation
        useEffect(() => {
            if (step === 'intro') {
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        speed: 12,
                        bounciness: 6,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        }, [step]);

        // Success animation
        useEffect(() => {
            if (step === 'success') {
                Animated.sequence([
                    Animated.timing(successAnim, {
                        toValue: 1,
                        duration: 400,
                        easing: Easing.out(Easing.back(1.5)),
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(bounceAnim, {
                            toValue: -10,
                            duration: 150,
                            useNativeDriver: true,
                        }),
                        Animated.timing(bounceAnim, {
                            toValue: 0,
                            duration: 150,
                            useNativeDriver: true,
                        }),
                    ]),
                ]).start();

                // Auto close after success
                const timer = setTimeout(() => {
                    bottomSheetRef.current?.dismiss();
                    onSuccess();
                }, 2500);

                return () => clearTimeout(timer);
            }
        }, [step, onSuccess]);

        // Simulate face detection and challenge progress
        useEffect(() => {
            if (step === 'capturing') {
                const interval = setInterval(() => {
                    setChallengeProgress((prev) => {
                        const newProgress = Math.min(prev + 25 + Math.random() * 15, 100);

                        // Animate progress bar
                        Animated.timing(progressAnim, {
                            toValue: newProgress,
                            duration: 300,
                            useNativeDriver: false,
                        }).start();

                        if (newProgress >= 100) {
                            clearInterval(interval);
                            selectionFeedback(); // Haptic for challenge completion
                            // Move to next challenge or complete
                            setTimeout(() => {
                                const nextIndex = challengesPassed + 1;
                                if (nextIndex < totalChallenges) {
                                    setChallengesPassed(nextIndex);
                                    setCurrentChallenge(challenges[nextIndex]);
                                    setChallengeProgress(0);
                                    progressAnim.setValue(0);
                                } else {
                                    // All challenges passed
                                    setStep('verifying');
                                    setTimeout(() => {
                                        setStep('success');
                                        celebrationPattern(); // Celebration haptic on success!
                                    }, 1500);
                                }
                            }, 400);
                        }

                        return newProgress;
                    });
                }, 600);

                return () => clearInterval(interval);
            }
        }, [step, challengesPassed, totalChallenges]);

        const handleStartCapture = async () => {
            mediumImpact(); // Haptic on start
            if (!permission?.granted) {
                const result = await requestPermission();
                if (!result.granted) return;
            }
            setStep('capturing');
        };

        const handleRetry = () => {
            lightImpact(); // Haptic on retry
            setStep('intro');
            setChallengesPassed(0);
            setCurrentChallenge('center');
            setChallengeProgress(0);
            progressAnim.setValue(0);
        };

        const handleCancel = () => {
            bottomSheetRef.current?.dismiss();
            onCancel?.();
        };

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.6}
                />
            ),
            []
        );

        const renderIntro = () => (
            <Animated.View
                style={{
                    flex: 1,
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                }}
            >
                <View className="items-center flex-1 justify-center">
                    {/* Icon */}
                    <View className="h-28 w-28 items-center justify-center rounded-full bg-[#F0EDFC] mb-6">
                        <MaterialCommunityIcons name="face-recognition" size={56} color={PRIMARY_COLOR} />
                    </View>

                    <Text className="font-heading text-[24px] text-[#181A20] mb-2 text-center">
                        Liveness Check
                    </Text>
                    <Text className="text-[15px] text-[#8F94A4] text-center px-8 leading-[22px]">
                        We need to verify it's really you. Follow the on-screen instructions to complete the check-in.
                    </Text>

                    {/* Instructions */}
                    <View className="mt-8 bg-white rounded-[20px] p-5 mx-4 w-full">
                        <Text className="font-medium text-[14px] text-[#181A20] mb-4">What to expect:</Text>

                        <View className="flex-row items-center mb-3">
                            <View className="h-8 w-8 rounded-full bg-[#E8F5E9] items-center justify-center">
                                <Text className="font-bold text-[#4CAF50]">1</Text>
                            </View>
                            <Text className="text-[13px] text-[#5A5D6B] ml-3 flex-1">
                                Position your face in the frame
                            </Text>
                        </View>

                        <View className="flex-row items-center mb-3">
                            <View className="h-8 w-8 rounded-full bg-[#E3F2FD] items-center justify-center">
                                <Text className="font-bold text-[#2196F3]">2</Text>
                            </View>
                            <Text className="text-[13px] text-[#5A5D6B] ml-3 flex-1">
                                Follow simple face gestures
                            </Text>
                        </View>

                        <View className="flex-row items-center">
                            <View className="h-8 w-8 rounded-full bg-[#F0EDFC] items-center justify-center">
                                <Text className="font-bold text-[#6343cc]">3</Text>
                            </View>
                            <Text className="text-[13px] text-[#5A5D6B] ml-3 flex-1">
                                Keep steady until verified
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Start Button */}
                <View className="px-4 pb-2">
                    <Pressable
                        onPress={handleStartCapture}
                        className="h-14 rounded-[14px] bg-[#6343cc] items-center justify-center flex-row"
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                    >
                        <MaterialCommunityIcons name="camera-iris" size={22} color="#fff" />
                        <Text className="font-medium text-[16px] text-white ml-2">Start Verification</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleCancel}
                        className="h-12 items-center justify-center mt-2"
                    >
                        <Text className="font-medium text-[14px] text-[#8F94A4]">Cancel</Text>
                    </Pressable>
                </View>
            </Animated.View>
        );

        const renderCapturing = () => {
            const progressWidth = progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
            });

            const ringScale = ringAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
            });

            const currentInstruction = CHALLENGE_INSTRUCTIONS[currentChallenge];

            return (
                <View className="flex-1">
                    {/* Camera View */}
                    <View className="flex-1 items-center justify-center">
                        <View
                            style={{
                                width: SCREEN_WIDTH * 0.7,
                                height: SCREEN_WIDTH * 0.9,
                                borderRadius: SCREEN_WIDTH * 0.35,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Animated Ring */}
                            <Animated.View
                                style={[
                                    styles.scanRing,
                                    {
                                        transform: [{ scale: pulseAnim }, { scale: ringScale }],
                                        borderColor: PRIMARY_COLOR,
                                    },
                                ]}
                            />

                            {/* Camera */}
                            {permission?.granted && (
                                <CameraView
                                    style={StyleSheet.absoluteFill}
                                    facing="front"
                                />
                            )}

                            {/* Overlay */}
                            <View style={styles.cameraOverlay} />

                            {/* Face Guide */}
                            <View style={styles.faceGuide}>
                                <View style={styles.faceOutline} />
                            </View>
                        </View>
                    </View>

                    {/* Challenge Info */}
                    <View className="px-4 pb-4">
                        {/* Progress Indicator */}
                        <View className="flex-row items-center justify-center mb-4">
                            {challenges.map((_, index) => (
                                <View
                                    key={index}
                                    className={`h-2 w-2 rounded-full mx-1 ${index < challengesPassed
                                        ? 'bg-[#4CAF50]'
                                        : index === challengesPassed
                                            ? 'bg-[#6343cc]'
                                            : 'bg-[#E8EAF1]'
                                        }`}
                                />
                            ))}
                        </View>

                        {/* Instruction Card */}
                        <View className="rounded-[16px] bg-white p-5 mb-4">
                            <View className="flex-row items-center">
                                <View className="h-14 w-14 rounded-full bg-[#F0EDFC] items-center justify-center">
                                    <MaterialCommunityIcons
                                        name={currentInstruction.icon as any}
                                        size={28}
                                        color={PRIMARY_COLOR}
                                        style={currentChallenge === 'turn_left' ? { transform: [{ scaleX: -1 }] } : {}}
                                    />
                                </View>
                                <View className="ml-4 flex-1">
                                    <Text className="font-heading text-[16px] text-[#181A20]">
                                        {currentInstruction.text}
                                    </Text>
                                    <View className="h-2 rounded-full bg-[#F1F2F6] mt-2 overflow-hidden">
                                        <Animated.View
                                            className="h-full rounded-full bg-[#6343cc]"
                                            style={{ width: progressWidth }}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            );
        };

        const renderVerifying = () => (
            <View className="flex-1 items-center justify-center px-4">
                <View className="h-24 w-24 rounded-full bg-[#F0EDFC] items-center justify-center mb-6">
                    <Animated.View
                        style={{
                            transform: [
                                {
                                    rotate: pulseAnim.interpolate({
                                        inputRange: [1, 1.1],
                                        outputRange: ['0deg', '360deg'],
                                    }),
                                },
                            ],
                        }}
                    >
                        <MaterialCommunityIcons name="loading" size={48} color={PRIMARY_COLOR} />
                    </Animated.View>
                </View>
                <Text className="font-heading text-[20px] text-[#181A20] mb-2">Verifying...</Text>
                <Text className="text-[14px] text-[#8F94A4] text-center">
                    Please wait while we verify your identity
                </Text>
            </View>
        );

        const renderSuccess = () => (
            <View className="flex-1 items-center justify-center px-4">
                <Animated.View
                    style={{
                        transform: [
                            { scale: successAnim },
                            { translateY: bounceAnim },
                        ],
                    }}
                >
                    <View className="h-28 w-28 rounded-full bg-[#E8F5E9] items-center justify-center mb-6">
                        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                    </View>
                </Animated.View>

                <Animated.Text
                    className="font-heading text-[24px] text-[#181A20] mb-2 text-center"
                    style={{ opacity: successAnim }}
                >
                    Check-In Complete!
                </Animated.Text>
                <Animated.Text
                    className="text-[15px] text-[#8F94A4] text-center"
                    style={{ opacity: successAnim }}
                >
                    {studentName ? `Welcome, ${studentName}!` : 'Your attendance has been recorded.'}
                </Animated.Text>

                {classCode && (
                    <Animated.View
                        className="mt-4 px-4 py-2 rounded-full bg-[#F0EDFC]"
                        style={{ opacity: successAnim }}
                    >
                        <Text className="font-medium text-[13px] text-[#6343cc]">{classCode}</Text>
                    </Animated.View>
                )}
            </View>
        );

        const renderFailed = () => (
            <View className="flex-1 items-center justify-center px-4">
                <View className="h-28 w-28 rounded-full bg-[#FFEBEE] items-center justify-center mb-6">
                    <Ionicons name="close-circle" size={64} color="#EF5350" />
                </View>

                <Text className="font-heading text-[24px] text-[#181A20] mb-2 text-center">
                    Verification Failed
                </Text>
                <Text className="text-[15px] text-[#8F94A4] text-center px-4">
                    We couldn't verify your identity. Please try again in good lighting.
                </Text>

                <Pressable
                    onPress={handleRetry}
                    className="mt-8 h-14 px-8 rounded-[14px] bg-[#6343cc] items-center justify-center flex-row"
                >
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text className="font-medium text-[15px] text-white ml-2">Try Again</Text>
                </Pressable>

                <Pressable
                    onPress={handleCancel}
                    className="h-12 items-center justify-center mt-3"
                >
                    <Text className="font-medium text-[14px] text-[#8F94A4]">Cancel Check-In</Text>
                </Pressable>
            </View>
        );

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose={step === 'intro' || step === 'success' || step === 'failed'}
                handleIndicatorStyle={styles.handleIndicator}
                backgroundStyle={styles.background}
            >
                <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4 px-1">
                        <View className="flex-row items-center">
                            <View className="h-10 w-10 rounded-full bg-[#F0EDFC] items-center justify-center">
                                <MaterialCommunityIcons name="shield-check" size={22} color={PRIMARY_COLOR} />
                            </View>
                            <View className="ml-3">
                                <Text className="font-heading text-[18px] text-[#181A20]">Identity Verification</Text>
                                <Text className="text-[12px] text-[#8F94A4]">
                                    {step === 'capturing' ? `Step ${challengesPassed + 1} of ${totalChallenges}` : 'Secure check-in'}
                                </Text>
                            </View>
                        </View>
                        {(step === 'intro' || step === 'failed') && (
                            <Pressable
                                onPress={handleCancel}
                                className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                            >
                                <Ionicons name="close" size={18} color="#5A5D6B" />
                            </Pressable>
                        )}
                    </View>

                    {/* Content based on step */}
                    {step === 'intro' && renderIntro()}
                    {step === 'capturing' && renderCapturing()}
                    {step === 'verifying' && renderVerifying()}
                    {step === 'success' && renderSuccess()}
                    {step === 'failed' && renderFailed()}
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

LivenessCheckBottomSheet.displayName = 'LivenessCheckBottomSheet';

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#F6F6F9',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    handleIndicator: {
        width: 48,
        height: 4,
        backgroundColor: '#E8EAF1',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scanRing: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 4,
        borderRadius: 1000,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 1000,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    faceGuide: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    faceOutline: {
        width: '70%',
        height: '60%',
        borderRadius: 100,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderStyle: 'dashed',
    },
});
