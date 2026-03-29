import {
    WorkSans_300Light,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    useFonts,
} from '@expo-google-fonts/work-sans';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import "./global.css";

import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SplashScreen } from './src/screens/SplashScreen';

import { CalendarScreen } from './src/screens/CalendarScreen';
import { LeaveScreen } from './src/screens/LeaveScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

type AppScreen = 'splash' | 'onboarding' | 'home' | 'calendar' | 'leave' | 'profile';

export default function App() {
    const [screen, setScreen] = useState<AppScreen>('splash');
    const [splashFinished, setSplashFinished] = useState(false);
    const [transitionAnim] = useState(new Animated.Value(1));
    const [nextScreen, setNextScreen] = useState<AppScreen | null>(null);

    const [fontsLoaded] = useFonts({
        WorkSans_300Light,
        WorkSans_400Regular,
        WorkSans_500Medium,
        WorkSans_600SemiBold,
        WorkSans_700Bold,
    });

    // ✅ Fix showSplash
    const showSplash = screen === 'splash' && !splashFinished;

    // Animation handler
    const handleNavigate = (target: AppScreen) => {
        if (target === screen) return;

        setNextScreen(target);
        Animated.timing(transitionAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start(() => {
            setScreen(target);
            transitionAnim.setValue(1);
            setNextScreen(null);
        });
    };

    // ✅ Prevent render before fonts load
    if (!fontsLoaded) return null;

    let CurrentScreen = null;

    if (showSplash) {
        CurrentScreen = (
            <SplashScreen
                onFinish={() => {
                    setSplashFinished(true);
                    setScreen('onboarding');
                }}
            />
        );
    } else if (screen === 'onboarding') {
        CurrentScreen = <OnboardingScreen onGetStarted={() => setScreen('home')} />;
    } else if (screen === 'home') {
        CurrentScreen = <HomeScreen onNavigate={handleNavigate} activeScreen="home" />;
    } else if (screen === 'calendar') {
        CurrentScreen = <CalendarScreen onNavigate={handleNavigate} activeScreen="calendar" />;
    } else if (screen === 'leave') {
        CurrentScreen = <LeaveScreen onNavigate={handleNavigate} activeScreen="leave" />;
    } else if (screen === 'profile') {
        CurrentScreen = <ProfileScreen onNavigate={handleNavigate} activeScreen="profile" />;
    }

    let NextScreenComponent = null;

    if (nextScreen) {
        if (nextScreen === 'home')
            NextScreenComponent = <HomeScreen onNavigate={handleNavigate} activeScreen="home" />;
        else if (nextScreen === 'calendar')
            NextScreenComponent = <CalendarScreen onNavigate={handleNavigate} activeScreen="calendar" />;
        else if (nextScreen === 'leave')
            NextScreenComponent = <LeaveScreen onNavigate={handleNavigate} activeScreen="leave" />;
        else if (nextScreen === 'profile')
            NextScreenComponent = <ProfileScreen onNavigate={handleNavigate} activeScreen="profile" />;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F4F8" }}>
            <View className="flex-1 bg-[#F5F4F8]">
                {nextScreen && (
                    <Animated.View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            opacity: transitionAnim,
                            zIndex: 2,
                        }}
                    >
                        {NextScreenComponent}
                    </Animated.View>
                )}

                <Animated.View
                    style={
                        nextScreen
                            ? {
                                opacity: transitionAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0],
                                }),
                            }
                            : { flex: 1 }
                    }
                >
                    {CurrentScreen}
                </Animated.View>

                {!showSplash && <StatusBar style="dark" />}
            </View>
        </SafeAreaView>
    );
}