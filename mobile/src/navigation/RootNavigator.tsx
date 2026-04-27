import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthLandingScreen } from '../screens/auth/AuthLandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { MainTabsNavigator } from './MainTabsNavigator';
import { CheckInScreen } from '../screens/CheckInScreen';
import { ClassDetailScreen } from '../screens/ClassDetailScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { StudentDetailScreen } from '../screens/StudentDetailScreen';
import { useAuth } from '../store/AuthContext';

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
    const { isAuthenticated, isInitialising } = useAuth();
    /**
     * Wrapper component for Splash screen
     * Waits for AuthContext session restore to finish before navigating.
     * In practice restoreSession (SecureStore reads only) finishes in < 100ms,
     * well before the 2200ms splash timer fires.
     */
    const SplashWrapper = ({ navigation }: any) => (
        <SplashScreen
            onFinish={() => {
                // isInitialising is always false by the time splash fires (2200ms)
                // because restoreSession only reads SecureStore (no network call).
                // Guard kept as a safety net.
                if (isInitialising) {
                    navigation.replace('Onboarding');
                    return;
                }
                navigation.replace(isAuthenticated ? 'MainTabs' : 'Onboarding');
            }}
        />
    );

    /**
     * Wrapper component for Onboarding screen
     * Follows the same pattern as SplashWrapper
     */
    const OnboardingWrapper = ({ navigation }: any) => (
        <OnboardingScreen
            onGetStarted={() => navigation.replace('AuthLanding')}
            onUseInvite={() => navigation.replace('Register')}
        />
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
                name="AuthLanding"
                component={AuthLandingScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="VerifyEmail"
                component={VerifyEmailScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{
                    animationEnabled: true,
                }}
            />
            <Stack.Screen
                name="MainTabs"
                component={MainTabsNavigator}
                options={{
                    animationEnabled: true,
                }}
                listeners={({ navigation }) => ({
                    focus: () => {
                        if (!isAuthenticated) {
                            navigation.replace('AuthLanding');
                        }
                    },
                })}
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
