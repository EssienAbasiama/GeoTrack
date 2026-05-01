import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    useEffect,
} from 'react';
import {
    Pressable,
    Text,
    View,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

const PRIMARY_COLOR = '#6343cc';

interface GeoLocation {
    latitude: number;
    longitude: number;
    radius: number; // in meters
    name: string;
}

export interface SetLocationBottomSheetRef {
    open: () => void;
    close: () => void;
}

interface SetLocationBottomSheetProps {
    classCode: string;
    onSaveLocation: (location: GeoLocation) => void;
    existingLocation?: GeoLocation | null;
}

export const SetLocationBottomSheet = forwardRef<SetLocationBottomSheetRef, SetLocationBottomSheetProps>(
    ({ classCode, onSaveLocation, existingLocation }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const insets = useSafeAreaInsets();

        const [locationName, setLocationName] = useState('');
        const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [isFetchingLocation, setIsFetchingLocation] = useState(false);
        const [radius, setRadius] = useState(50); // Default 50 meters geofence radius

        const snapPoints = useMemo(() => ['70%'], []);

        useImperativeHandle(ref, () => ({
            open: () => {
                // Reset state when opening
                setLocationName(existingLocation?.name || '');
                setCurrentLocation(existingLocation ? { latitude: existingLocation.latitude, longitude: existingLocation.longitude } : null);
                setRadius(existingLocation?.radius || 50);
                bottomSheetRef.current?.present();
            },
            close: () => bottomSheetRef.current?.dismiss(),
        }));

        const fetchCurrentLocation = async () => {
            setIsFetchingLocation(true);
            try {
                // Use permission utility with proper denial handling
                const hasPermission = await ensureLocationPermission(() => {
                    setIsFetchingLocation(false);
                });

                if (!hasPermission) {
                    setIsFetchingLocation(false);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                setCurrentLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Failed to get current location. Please try again.', position: "bottom" });
            } finally {
                setIsFetchingLocation(false);
            }
        };

        const handleSave = () => {
            if (!locationName.trim()) {
                Toast.show({ type: 'error', text1: 'Please enter a location name', position: "bottom" });
                return;
            }
            if (!currentLocation) {
                Toast.show({ type: 'error', text1: 'Please capture your current location first', position: "bottom" });
                return;
            }

            setIsLoading(true);
            // Simulate saving
            setTimeout(() => {
                onSaveLocation({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    radius,
                    name: locationName.trim(),
                });
                setIsLoading(false);
                bottomSheetRef.current?.dismiss();
            }, 500);
        };

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        const radiusOptions = [30, 50, 100, 150, 200];

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                enablePanDownToClose
                keyboardBehavior="extend"
                android_keyboardInputMode="adjustResize"
                handleIndicatorStyle={styles.handleIndicator}
                backgroundStyle={styles.background}
            >
                <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-1">
                            <Text className="font-heading text-[20px] text-[#181A20]">Set Class Location</Text>
                            <Text className="text-[13px] text-[#8F94A4] mt-1">{classCode}</Text>
                        </View>
                        <Pressable
                            onPress={() => bottomSheetRef.current?.dismiss()}
                            className="h-8 w-8 items-center justify-center rounded-full bg-[#F1F2F6]"
                        >
                            <Ionicons name="close" size={18} color="#5A5D6B" />
                        </Pressable>
                    </View>

                    {/* Info Card */}
                    <View className="rounded-[16px] bg-[#FFF8E1] p-4 mb-5">
                        <View className="flex-row items-start">
                            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFE082]">
                                <Ionicons name="information" size={18} color="#FF8F00" />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text className="font-medium text-[14px] text-[#E65100] mb-1">How it works</Text>
                                <Text className="text-[12px] text-[#FF8F00] leading-5">
                                    Stand at the class location and capture your position. This creates a geofence that helps students verify they're in the right place.
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Location Name Input */}
                    <View className="mb-5">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Location Name</Text>
                        <View className="flex-row items-center h-[52px] rounded-[14px] bg-white border border-[#E8EAF1] px-4">
                            <Ionicons name="pricetag-outline" size={18} color="#8F94A4" />
                            <BottomSheetTextInput
                                value={locationName}
                                onChangeText={setLocationName}
                                placeholder="e.g., LT 201, Faculty Building A"
                                placeholderTextColor="#B8BBC6"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Current Location */}
                    <View className="mb-5">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">GPS Coordinates</Text>
                        <View className="rounded-[16px] bg-white border border-[#E8EAF1] p-4">
                            {currentLocation ? (
                                <View className="flex-row items-center">
                                    <View className="h-11 w-11 items-center justify-center rounded-full bg-[#E8F5E9]">
                                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="font-medium text-[14px] text-[#181A20]">Location Captured</Text>
                                        <Text className="text-[11px] text-[#8F94A4] mt-0.5">
                                            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={fetchCurrentLocation}
                                        className="h-9 w-9 items-center justify-center rounded-full bg-[#F0EDFC]"
                                    >
                                        <Ionicons name="refresh" size={18} color={PRIMARY_COLOR} />
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable
                                    onPress={fetchCurrentLocation}
                                    disabled={isFetchingLocation}
                                    className="flex-row items-center justify-center py-3"
                                >
                                    {isFetchingLocation ? (
                                        <>
                                            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                                            <Text className="ml-3 font-medium text-[14px] text-[#6343cc]">
                                                Getting location...
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#F0EDFC]">
                                                <MaterialIcons name="my-location" size={22} color={PRIMARY_COLOR} />
                                            </View>
                                            <View className="ml-3">
                                                <Text className="font-medium text-[14px] text-[#181A20]">Capture Current Location</Text>
                                                <Text className="text-[11px] text-[#8F94A4]">Tap to get GPS coordinates</Text>
                                            </View>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {/* Geofence Radius */}
                    <View className="mb-6">
                        <Text className="text-[13px] font-medium text-[#5A5D6B] mb-2">Geofence Radius</Text>
                        <View className="flex-row gap-2">
                            {radiusOptions.map((r) => (
                                <Pressable
                                    key={r}
                                    onPress={() => setRadius(r)}
                                    className={`flex-1 h-11 items-center justify-center rounded-[12px] border ${radius === r
                                        ? 'bg-[#6343cc] border-[#6343cc]'
                                        : 'bg-white border-[#E8EAF1]'
                                        }`}
                                >
                                    <Text
                                        className={`font-medium text-[13px] ${radius === r ? 'text-white' : 'text-[#5A5D6B]'
                                            }`}
                                    >
                                        {r}m
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text className="text-[11px] text-[#8F94A4] mt-2 text-center">
                            Students must be within {radius} meters to be considered present
                        </Text>
                    </View>

                    {/* Save Button */}
                    <Pressable
                        onPress={handleSave}
                        disabled={isLoading || !currentLocation || !locationName.trim()}
                        className={`h-14 items-center justify-center rounded-[14px] ${currentLocation && locationName.trim()
                            ? 'bg-[#6343cc]'
                            : 'bg-[#E8EAF1]'
                            }`}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text
                                className={`font-medium text-[16px] ${currentLocation && locationName.trim()
                                    ? 'text-white'
                                    : 'text-[#B8BBC6]'
                                    }`}
                            >
                                Save Location
                            </Text>
                        )}
                    </Pressable>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

SetLocationBottomSheet.displayName = 'SetLocationBottomSheet';

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#F6F6F9',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    handleIndicator: {
        width: 88,
        height: 4,
        borderRadius: 3,
        backgroundColor: '#BCBDC0',
        alignSelf: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    input: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        color: '#181A20',
    },
});
