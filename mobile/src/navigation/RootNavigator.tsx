import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainTabsNavigator } from './MainTabsNavigator';
import { CheckInScreen } from '../screens/CheckInScreen';
import { ClassDetailScreen } from '../screens/ClassDetailScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { StudentDetailScreen } from '../screens/StudentDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator
 * 
 * Manages the root-level navigation stack for the entire app.
 * This is responsible for handling:
 * - Splash screen display
 * - Onboarding flow
 * - Main app navigation (once authenticated/onboarded)
 * 
 * Navigation Flow:
 * Splash (shown first) → replace → Onboarding → replace → MainTabs
 * 
 * Using replace() ensures users can't navigate backwards to previous screens.
 * This approach provides:
 * - Separation of concerns (root navigation vs. tab navigation)
 * - Clean navigation flow without conditional screen rendering
 * - Easy to extend for authentication flows
 * - All screens defined upfront (React Navigation requirement)
 */
export function RootNavigator() {
    /**
     * Wrapper component for Splash screen
     * This allows the splash screen to call navigation methods
     * while keeping the component structure clean
     */
    const SplashWrapper = ({ navigation }: any) => (
        <SplashScreen onFinish={() => navigation.replace('Onboarding')} />
    );

    /**
     * Wrapper component for Onboarding screen
     * Follows the same pattern as SplashWrapper
     */
    const OnboardingWrapper = ({ navigation }: any) => (
        <OnboardingScreen onGetStarted={() => navigation.replace('MainTabs')} />
    );

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                /**
                 * Animation configuration for stack transitions
                 * Disabled for splash/onboarding to provide instant transitions
                 */
                animationEnabled: false,
            }}
            initialRouteName="Splash"
        >
            <Stack.Screen
                name="Splash"
                component={SplashWrapper}
                options={{
                    animationEnabled: false,
                }}
            />
            <Stack.Screen
                name="Onboarding"
                component={OnboardingWrapper}
                options={{
                    animationEnabled: false,
                }}
            />
            <Stack.Screen
                name="MainTabs"
                component={MainTabsNavigator}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="CheckIn"
                component={CheckInScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="ClassDetail"
                component={ClassDetailScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="Navigation"
                component={NavigationScreen}
                options={{
                    animationEnabled: true,
                    presentation: 'fullScreenModal',
                }}
            />
            <Stack.Screen
                name="StudentDetail"
                component={StudentDetailScreen}
                options={{
                    animationEnabled: true,
                }}
            />
        </Stack.Navigator>
    );
}
