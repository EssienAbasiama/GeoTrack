import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Request location permission with proper denial handling.
 * If permission was previously denied, prompts user to open settings.
 * 
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export async function requestLocationPermission(): Promise<boolean> {
    try {
        // First check current status
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

        if (existingStatus === 'granted') {
            return true;
        }

        // Request permission
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
            return true;
        }

        // Permission denied
        if (!canAskAgain) {
            // User selected "Don't ask again" - need to go to settings
            showSettingsAlert(
                'Location Permission Required',
                'Location access is needed for this feature. Please enable it in your device settings.'
            );
        } else {
            // User denied but can ask again
            Alert.alert(
                'Permission Required',
                'Location permission is needed to use this feature. Would you like to grant access?',
                [
                    { text: 'Not Now', style: 'cancel' },
                    {
                        text: 'Grant Permission',
                        onPress: async () => {
                            const result = await Location.requestForegroundPermissionsAsync();
                            return result.status === 'granted';
                        },
                    },
                ]
            );
        }

        return false;
    } catch (error) {
        console.error('Error requesting location permission:', error);
        return false;
    }
}

/**
 * Show an alert prompting user to open settings
 */
export function showSettingsAlert(title: string, message: string): void {
    Alert.alert(
        title,
        message,
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Open Settings',
                onPress: () => openAppSettings(),
            },
        ]
    );
}

/**
 * Open the app's settings page
 */
export function openAppSettings(): void {
    if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
    } else {
        Linking.openSettings();
    }
}

/**
 * Check if location permission can still be requested
 * @returns Promise<{ granted: boolean; canAskAgain: boolean }>
 */
export async function checkLocationPermissionStatus(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
}> {
    try {
        const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        return {
            granted: status === 'granted',
            canAskAgain: canAskAgain ?? true,
        };
    } catch (error) {
        console.error('Error checking location permission:', error);
        return { granted: false, canAskAgain: true };
    }
}

/**
 * Ensure location permission is available, showing appropriate UI if not.
 * This is meant to be called before any location-dependent operation.
 * 
 * @param onPermissionDenied - Optional callback when permission is ultimately denied
 * @returns Promise<boolean> - true if permission is available
 */
export async function ensureLocationPermission(
    onPermissionDenied?: () => void
): Promise<boolean> {
    const { granted, canAskAgain } = await checkLocationPermissionStatus();

    if (granted) {
        return true;
    }

    if (!canAskAgain) {
        // Must go to settings
        return new Promise((resolve) => {
            Alert.alert(
                'Location Access Required',
                'This feature requires location access. Please enable location permission in your device settings to continue.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {
                            onPermissionDenied?.();
                            resolve(false);
                        },
                    },
                    {
                        text: 'Open Settings',
                        onPress: () => {
                            openAppSettings();
                            // We can't know if user enabled permission from settings
                            // So we resolve false and let the next attempt handle it
                            resolve(false);
                        },
                    },
                ]
            );
        });
    }

    // Can ask again - request permission
    const result = await Location.requestForegroundPermissionsAsync();
    
    if (result.status !== 'granted') {
        onPermissionDenied?.();
        return false;
    }

    return true;
}
