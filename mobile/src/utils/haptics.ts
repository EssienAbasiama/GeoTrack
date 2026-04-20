import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback utilities for GeoTrack
 * Provides consistent haptic feedback across the app
 */

// Check if haptics are available (iOS and some Android devices)
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Light impact - for subtle UI interactions
 * Use for: button taps, toggles, selections
 */
export const lightImpact = () => {
    if (isHapticsAvailable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
};

/**
 * Medium impact - for confirmations
 * Use for: successful actions, tab switches, modal open
 */
export const mediumImpact = () => {
    if (isHapticsAvailable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
};

/**
 * Heavy impact - for significant actions
 * Use for: check-in success, important confirmations
 */
export const heavyImpact = () => {
    if (isHapticsAvailable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
};

/**
 * Success feedback - celebratory pattern
 * Use for: successful check-in, verification passed
 */
export const successFeedback = () => {
    if (isHapticsAvailable) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
};

/**
 * Warning feedback - caution pattern
 * Use for: GPS accuracy issues, approaching boundaries
 */
export const warningFeedback = () => {
    if (isHapticsAvailable) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
};

/**
 * Error feedback - failure pattern
 * Use for: check-in failed, outside boundary, verification failed
 */
export const errorFeedback = () => {
    if (isHapticsAvailable) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
};

/**
 * Selection feedback - very light tap
 * Use for: picker changes, slider movements, small selections
 */
export const selectionFeedback = () => {
    if (isHapticsAvailable) {
        Haptics.selectionAsync();
    }
};

/**
 * Custom pattern for special events
 * Double tap pattern for extra celebration
 */
export const celebrationPattern = async () => {
    if (isHapticsAvailable) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
};

/**
 * Soft pulse for loading states
 */
export const softPulse = () => {
    if (isHapticsAvailable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
};

/**
 * Rigid tap for hard UI elements
 */
export const rigidTap = () => {
    if (isHapticsAvailable) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }
};

export default {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successFeedback,
    warningFeedback,
    errorFeedback,
    selectionFeedback,
    celebrationPattern,
    softPulse,
    rigidTap,
};
