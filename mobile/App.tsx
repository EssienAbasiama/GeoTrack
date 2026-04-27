import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
    WorkSans_300Light,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    useFonts,
} from '@expo-google-fonts/work-sans';

import './global.css';
import { RootNavigator } from './src/navigation/RootNavigator';
import { RoleProvider } from './src/store/RoleContext';
import { AuthProvider } from './src/store/AuthContext';
import { AttendanceControlProvider } from './src/store/AttendanceControlContext';
import { navigationRef } from './src/services/apiClient';
import {
    requestNotificationPermissions,
    configureAndroidChannel,
    addNotificationResponseListener,
    addNotificationReceivedListener,
    clearBadge,
} from './src/services/notifications';

/**
 * App Component
 * 
 * Root component of the application.
 * Responsibilities:
 * - Load custom fonts
 * - Set up navigation container
 * - Configure safe area
 * - Display status bar
 * 
 * This component is intentionally kept minimal to separate concerns:
 * - App setup (fonts, providers) stays here
 * - Navigation logic moved to RootNavigator
 * - Screen-specific navigation moved to MainTabsNavigator
 * 
 * Benefits:
 * - Easy to test individual navigators
 * - Simple to add new providers (auth, theme, etc.)
 * - Clean app initialization logic
 */
export default function App() {
    const [fontsLoaded] = useFonts({
        WorkSans_300Light,
        WorkSans_400Regular,
        WorkSans_500Medium,
        WorkSans_600SemiBold,
        WorkSans_700Bold,
    });

    // Initialize notifications
    useEffect(() => {
        const initNotifications = async () => {
            // Configure Android notification channels
            await configureAndroidChannel();

            // Request permissions
            await requestNotificationPermissions();

            // Clear badge on app open
            await clearBadge();
        };

        initNotifications();

        // Listen for notification interactions
        const responseSubscription = addNotificationResponseListener((response) => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped:', data);
            // Handle navigation based on notification type
            // e.g., navigate to class detail if classCode is present
        });

        // Listen for foreground notifications
        const receivedSubscription = addNotificationReceivedListener((notification) => {
            console.log('Notification received in foreground:', notification);
        });

        return () => {
            responseSubscription.remove();
            receivedSubscription.remove();
        };
    }, []);

    // Don't render anything until fonts are loaded
    if (!fontsLoaded) return null;

    const linking = {
        prefixes: [Linking.createURL('/'), 'geotrack://'],
        config: {
            screens: {
                Register: 'register',
            },
        },
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <RoleProvider>
                    <AttendanceControlProvider>
                        <BottomSheetModalProvider>
                            <View style={{ flex: 1, backgroundColor: '#F5F4F8' }}>
                                <AuthProvider>
                                    <NavigationContainer linking={linking} ref={navigationRef}>
                                        <RootNavigator />
                                    </NavigationContainer>
                                </AuthProvider>
                                <StatusBar style="dark" />
                            </View>
                        </BottomSheetModalProvider>
                    </AttendanceControlProvider>
                </RoleProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
