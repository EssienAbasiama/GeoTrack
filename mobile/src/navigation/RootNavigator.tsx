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
import { DeviceConflictScreen } from '../screens/DeviceConflictScreen';
import { FaceEnrollmentScreen } from '../screens/FaceEnrollmentScreen';
import { PresenceCheckScreen } from '../screens/PresenceCheckScreen';
import { LecturerSessionScreen } from '../screens/LecturerSessionScreen';
import { JoinClassScreen } from '../screens/JoinClassScreen';
import { PasswordManagerScreen } from '../screens/PasswordManagerScreen';
import { HelpCenterScreen } from '../screens/HelpCenterScreen';
import { useAuth } from '../store/AuthContext';
import { navigationRef } from '../services/apiClient';
import { useEffect } from 'react';

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
    const { isAuthenticated, pendingInviteToken, setPendingInviteToken } = useAuth();

    // Resume a class-invite link that was opened while signed out, once the
    // user authenticates. Push JoinClass on top of the freshly-shown MainTabs.
    useEffect(() => {
        if (isAuthenticated && pendingInviteToken && navigationRef.isReady()) {
            const token = pendingInviteToken;
            setPendingInviteToken(null);
            navigationRef.navigate('JoinClass', { token });
        }
    }, [isAuthenticated, pendingInviteToken, setPendingInviteToken]);
    /**
     * Wrapper component for Splash screen
     * Waits for AuthContext session restore to finish before navigating.
     * In practice restoreSession (SecureStore reads only) finishes in < 100ms,
     * well before the 2200ms splash timer fires.
     */
    const SplashWrapper = ({ navigation }: any) => (
        <SplashScreen
            onFinish={() => {
                navigation.replace(isAuthenticated ? 'MainTabs' : 'AuthLanding');
            }}
        />
    );

    /**
     * Wrapper component for Onboarding screen
     * Follows the same pattern as SplashWrapper
     */
    const OnboardingWrapper = ({ navigation }: any) => (
        <OnboardingScreen
            onGetStarted={() => navigation.replace('Register')}
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
                animation: 'none',
            }}
            initialRouteName="Splash"
        >
            <Stack.Screen
                name="Splash"
                component={SplashWrapper}
                options={{
                    animation: 'none',
                }}
            />
            <Stack.Screen
                name="Onboarding"
                component={OnboardingWrapper}
                options={{
                    animation: 'none',
                }}
            />
            <Stack.Screen
                name="AuthLanding"
                component={AuthLandingScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="VerifyEmail"
                component={VerifyEmailScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="MainTabs"
                component={MainTabsNavigator}
                options={{
                    animation: 'default',
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
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="ClassDetail"
                component={ClassDetailScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="Navigation"
                component={NavigationScreen}
                options={{
                    animation: 'default',
                    presentation: 'fullScreenModal',
                }}
            />
            <Stack.Screen
                name="StudentDetail"
                component={StudentDetailScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="DeviceConflict"
                component={DeviceConflictScreen}
                options={{
                    animation: 'default',
                    gestureEnabled: false,
                }}
            />
            <Stack.Screen
                name="FaceEnrollment"
                component={FaceEnrollmentScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="PresenceCheck"
                component={PresenceCheckScreen}
                options={{
                    animation: 'default',
                    presentation: 'modal',
                    gestureEnabled: false,
                }}
            />
            <Stack.Screen
                name="LecturerSession"
                component={LecturerSessionScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="JoinClass"
                component={JoinClassScreen}
                options={{
                    animation: 'default',
                }}
            />
            <Stack.Screen
                name="PasswordManager"
                component={PasswordManagerScreen}
                options={{ animation: 'default' }}
            />
            <Stack.Screen
                name="HelpCenter"
                component={HelpCenterScreen}
                options={{ animation: 'default' }}
            />
        </Stack.Navigator>
    );
}
