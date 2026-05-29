import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { pushTokenApi } from './apiClient';
import { getDeviceUid, setStoredPushToken, getStoredPushToken } from '../utils/secureStorage';

/**
 * Notification Service for GeoTrack
 * Handles push notifications, local notifications, and scheduling
 */

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Notification categories for different types of alerts
export const NotificationCategory = {
    CLASS_REMINDER: 'class_reminder',
    CHECK_IN_REMINDER: 'check_in_reminder',
    ATTENDANCE_ALERT: 'attendance_alert',
    CLASS_STARTED: 'class_started',
    CLASS_ENDING: 'class_ending',
    GENERAL: 'general',
} as const;

export type NotificationCategoryType = typeof NotificationCategory[keyof typeof NotificationCategory];

// Push notification token storage
let pushToken: string | null = null;

/**
 * Request notification permissions
 * @returns Permission status
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return false;
    }

    return true;
}

/**
 * Get the Expo push token for this device
 * @returns Push token string or null
 */
export async function getPushToken(): Promise<string | null> {
    if (pushToken) return pushToken;

    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        
        const token = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
        });
        
        pushToken = token.data;
        return pushToken;
    } catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }
}

/**
 * Schedule a class reminder notification
 * @param classCode - e.g., "ELE 512"
 * @param className - e.g., "Digital Signal Processing"
 * @param venue - e.g., "LT 201"
 * @param startTime - Date object for class start time
 * @param minutesBefore - How many minutes before to notify (default: 15)
 */
export async function scheduleClassReminder(
    classCode: string,
    className: string,
    venue: string,
    startTime: Date,
    minutesBefore: number = 15
): Promise<string | null> {
    const triggerTime = new Date(startTime.getTime() - minutesBefore * 60 * 1000);
    
    // Don't schedule if the time has already passed
    if (triggerTime <= new Date()) {
        return null;
    }

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: `📚 ${classCode} starts in ${minutesBefore} mins`,
                body: `${className} at ${venue}. Don't forget to check in!`,
                data: { 
                    type: NotificationCategory.CLASS_REMINDER,
                    classCode,
                    className,
                    venue,
                },
                sound: 'default',
                badge: 1,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerTime,
            },
        });

        return notificationId;
    } catch (error) {
        console.error('Error scheduling class reminder:', error);
        return null;
    }
}

/**
 * Schedule a check-in reminder (when class is about to end and student hasn't checked in)
 * @param classCode - e.g., "ELE 512"
 * @param endTime - Date object for class end time
 * @param minutesBefore - How many minutes before end to notify (default: 10)
 */
export async function scheduleCheckInReminder(
    classCode: string,
    endTime: Date,
    minutesBefore: number = 10
): Promise<string | null> {
    const triggerTime = new Date(endTime.getTime() - minutesBefore * 60 * 1000);
    
    if (triggerTime <= new Date()) {
        return null;
    }

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: `⚠️ Check-in Reminder`,
                body: `${classCode} ends in ${minutesBefore} mins. Check in now to avoid being marked absent!`,
                data: { 
                    type: NotificationCategory.CHECK_IN_REMINDER,
                    classCode,
                },
                sound: 'default',
                badge: 1,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerTime,
            },
        });

        return notificationId;
    } catch (error) {
        console.error('Error scheduling check-in reminder:', error);
        return null;
    }
}

/**
 * Send immediate notification (for real-time events)
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Additional data payload
 */
export async function sendImmediateNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<string | null> {
    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: data || {},
                sound: 'default',
            },
            trigger: null, // Immediate
        });

        return notificationId;
    } catch (error) {
        console.error('Error sending immediate notification:', error);
        return null;
    }
}

/**
 * Notify successful check-in
 */
export async function notifyCheckInSuccess(
    classCode: string,
    className: string
): Promise<void> {
    await sendImmediateNotification(
        '✅ Check-in Successful!',
        `You've checked in to ${classCode} - ${className}`,
        { type: NotificationCategory.ATTENDANCE_ALERT, classCode }
    );
}

/**
 * Notify class started
 */
export async function notifyClassStarted(
    classCode: string,
    venue: string
): Promise<void> {
    await sendImmediateNotification(
        `🎓 ${classCode} has started`,
        `Head to ${venue} and check in to mark your attendance`,
        { type: NotificationCategory.CLASS_STARTED, classCode }
    );
}

/**
 * Notify attendance percentage (weekly summary)
 */
export async function notifyAttendanceSummary(
    percentage: number,
    totalClasses: number,
    attended: number
): Promise<void> {
    const emoji = percentage >= 80 ? '🌟' : percentage >= 60 ? '📊' : '⚠️';
    const message = percentage >= 80 
        ? 'Great job! Keep it up!' 
        : percentage >= 60 
            ? 'Good progress, but there\'s room for improvement.' 
            : 'Your attendance needs attention. Try not to miss more classes.';

    await sendImmediateNotification(
        `${emoji} Weekly Attendance: ${percentage}%`,
        `${attended}/${totalClasses} classes attended. ${message}`,
        { type: NotificationCategory.ATTENDANCE_ALERT, percentage }
    );
}

/**
 * Cancel a scheduled notification
 * @param notificationId - ID returned from schedule functions
 */
export async function cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set badge count
 * @param count - Badge number to display
 */
export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
}

/**
 * Configure Android notification channel
 */
export async function configureAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('class-reminders', {
            name: 'Class Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#6343cc',
            sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('attendance-alerts', {
            name: 'Attendance Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 500, 500],
            lightColor: '#4CAF50',
            sound: 'default',
        });
    }
}

/**
 * Add notification response listener
 * @param callback - Function to call when user interacts with notification
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (foreground)
 * @param callback - Function to call when notification is received in foreground
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Register the Expo push token with the backend. Skips work if we've already
 * registered the same token for the same device.
 */
export async function registerPushTokenWithBackend(): Promise<void> {
    const token = await getPushToken();
    if (!token) return;
    const deviceUid = await getDeviceUid();
    if (!deviceUid) return;

    const already = await getStoredPushToken();
    if (already === token) return;

    try {
        await pushTokenApi.register({
            token,
            device_uid: deviceUid,
            platform: Platform.OS,
        });
        await setStoredPushToken(token);
    } catch (error) {
        console.warn('Failed to register push token with backend:', error);
    }
}

export default {
    requestNotificationPermissions,
    getPushToken,
    registerPushTokenWithBackend,
    scheduleClassReminder,
    scheduleCheckInReminder,
    sendImmediateNotification,
    notifyCheckInSuccess,
    notifyClassStarted,
    notifyAttendanceSummary,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    setBadgeCount,
    clearBadge,
    configureAndroidChannel,
    addNotificationResponseListener,
    addNotificationReceivedListener,
    NotificationCategory,
};
