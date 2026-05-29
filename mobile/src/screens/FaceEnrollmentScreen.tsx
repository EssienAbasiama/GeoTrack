import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { faceApi } from '../services/apiClient';
import type { ApiFaceProfile } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'FaceEnrollment'>;

const PRIMARY = '#6343cc';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function FaceEnrollmentScreen({ navigation }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState<ApiFaceProfile | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        faceApi
            .status()
            .then(({ data }) => {
                if (mounted) setProfile(data.profile);
            })
            .catch(() => { /* show enroll flow regardless */ })
            .finally(() => mounted && setStatusLoading(false));
        return () => { mounted = false; };
    }, []);

    const handleCapture = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({
                    type: 'error',
                    text1: 'Camera permission is required to enroll your face.',
                    position: 'bottom',
                });
                return;
            }
        }
        if (!cameraRef.current) return;

        setCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.6,
                base64: true,
                skipProcessing: false,
            });
            if (!photo?.base64) {
                Toast.show({
                    type: 'error',
                    text1: 'Could not capture image. Try again.',
                    position: 'bottom',
                });
                return;
            }

            setUploading(true);
            const { data } = await faceApi.enroll(photo.base64);
            setProfile(data.profile);
            Toast.show({
                type: 'success',
                text1: 'Face enrolled. You can now check in to classes.',
                position: 'bottom',
            });
        } catch (err) {
            const msg =
                (err as any)?.response?.data?.message ??
                'Failed to enroll face. Please retake the photo.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        } finally {
            setCapturing(false);
            setUploading(false);
        }
    };

    const handleClear = async () => {
        try {
            await faceApi.clear();
            setProfile({ enrolled: false });
            Toast.show({ type: 'success', text1: 'Face profile cleared.', position: 'bottom' });
        } catch (err) {
            const msg = (err as any)?.response?.data?.message ?? 'Could not clear face profile.';
            Toast.show({ type: 'error', text1: msg, position: 'bottom' });
        }
    };

    const renderHeader = () => (
        <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            <Pressable
                onPress={() => navigation.goBack()}
                className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm shadow-black/5"
            >
                <Ionicons name="chevron-back" size={20} color="#181A20" />
            </Pressable>
            <Text className="font-heading text-[18px] text-[#181A20]">Face Enrollment</Text>
            <View className="w-10" />
        </View>
    );

    if (statusLoading) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                {renderHeader()}
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={PRIMARY} />
                </View>
            </SafeAreaView>
        );
    }

    if (profile?.enrolled) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
                {renderHeader()}
                <View className="flex-1 items-center px-6 pt-10">
                    <View className="h-28 w-28 items-center justify-center rounded-full bg-[#E8F5E9] mb-6">
                        <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
                    </View>
                    <Text className="font-heading text-[22px] text-[#181A20] text-center">
                        Face profile active
                    </Text>
                    <Text className="text-[13px] text-[#8F94A4] text-center mt-2 leading-[20px]">
                        Your face has been enrolled and is used to verify check-ins for
                        face-recognition sessions.
                    </Text>

                    {profile.enrolled_at && (
                        <Text className="text-[12px] text-[#B8BBC6] mt-4">
                            Enrolled {new Date(profile.enrolled_at).toLocaleString()}
                        </Text>
                    )}

                    <Pressable
                        onPress={handleClear}
                        className="mt-10 h-12 px-6 items-center justify-center rounded-full border border-[#E7E8EE] bg-white"
                    >
                        <Text className="font-medium text-[14px] text-[#cc4361]">
                            Clear face profile
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            {renderHeader()}

            <View className="flex-1 px-5">
                <Text className="font-heading text-[20px] text-[#181A20] mt-2">
                    Capture a clear selfie
                </Text>
                <Text className="text-[13px] text-[#8F94A4] mt-2 leading-[20px]">
                    Center your face in the circle and keep good lighting. We will match
                    this photo against future check-ins.
                </Text>

                <View className="mt-6 items-center">
                    <View
                        style={{
                            width: SCREEN_WIDTH * 0.78,
                            height: SCREEN_WIDTH * 0.95,
                            borderRadius: SCREEN_WIDTH * 0.39,
                            overflow: 'hidden',
                            borderWidth: 3,
                            borderColor: PRIMARY,
                            backgroundColor: '#000',
                        }}
                    >
                        {permission?.granted ? (
                            <CameraView
                                ref={(ref) => {
                                    cameraRef.current = ref;
                                }}
                                style={StyleSheet.absoluteFill}
                                facing="front"
                            />
                        ) : (
                            <View className="flex-1 items-center justify-center px-4">
                                <MaterialCommunityIcons
                                    name="camera-off"
                                    size={48}
                                    color="#FFFFFF"
                                />
                                <Text className="text-white text-center mt-3 text-[13px]">
                                    Camera access is required
                                </Text>
                            </View>
                        )}
                        <View style={styles.faceGuide}>
                            <View style={styles.faceOutline} />
                        </View>
                    </View>
                </View>
            </View>

            <View className="px-5 pb-6">
                <Pressable
                    onPress={handleCapture}
                    disabled={capturing || uploading}
                    className="h-12 items-center justify-center rounded-full bg-[#6343cc]"
                >
                    {capturing || uploading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text className="font-medium text-[15px] text-white">
                            {permission?.granted ? 'Capture selfie' : 'Enable camera'}
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    faceGuide: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    faceOutline: {
        width: '72%',
        height: '60%',
        borderRadius: 1000,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderStyle: 'dashed',
    },
});
