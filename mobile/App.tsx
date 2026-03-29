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
import { View } from 'react-native';

import "./global.css";
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SplashScreen } from './src/screens/SplashScreen';

type AppScreen = 'splash' | 'onboarding' | 'home';

export default function App() {
    const [screen, setScreen] = useState<AppScreen>('splash');
    const [splashFinished, setSplashFinished] = useState(false);

    const [fontsLoaded] = useFonts({
        WorkSans_300Light,
        WorkSans_400Regular,
        WorkSans_500Medium,
        WorkSans_600SemiBold,
        WorkSans_700Bold,
    });

    const showSplash = !splashFinished || !fontsLoaded;

    return (
        <View className="flex-1 bg-[#F5F4F8]">
            {showSplash ? (
                <SplashScreen
                    onFinish={() => {
                        setSplashFinished(true);
                        setScreen('onboarding');
                    }}
                />
            ) : screen === 'onboarding' ? (
                <OnboardingScreen onGetStarted={() => setScreen('home')} />
            ) : (
                <HomeScreen />
            )}
            {!showSplash && <StatusBar style="dark" />}
        </View>
    );
}