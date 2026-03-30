import {
    WorkSans_300Light,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    useFonts,
} from '@expo-google-fonts/work-sans';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import './global.css';

import { SplashScreen } from './src/screens/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: '#6343cc',
                tabBarInactiveTintColor: '#B7BAC5',
                tabBarStyle: {
                    position: 'absolute',
                    height: 72,
                    left: 16,
                    right: 16,
                    bottom: 16,
                    borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.19)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.45)',
                    shadowColor: '#000',
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 15,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = 'home';

                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    if (route.name === 'Calendar') iconName = focused ? 'calendar' : 'calendar-outline';
                    if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 4,
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Calendar" component={CalendarScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

function SplashWrapper({ navigation }: any) {
    return <SplashScreen onFinish={() => navigation.replace('Onboarding')} />;
}

export default function App() {
    const [fontsLoaded] = useFonts({
        WorkSans_300Light,
        WorkSans_400Regular,
        WorkSans_500Medium,
        WorkSans_600SemiBold,
        WorkSans_700Bold,
    });

    if (!fontsLoaded) return null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F4F8' }}>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Splash" component={SplashWrapper} />
                    <Stack.Screen
                        name="Onboarding"
                        children={({ navigation }) => (
                            <OnboardingScreen onGetStarted={() => navigation.replace('MainTabs')} />
                        )}
                    />
                    <Stack.Screen name="MainTabs" component={HomeTabs} />
                </Stack.Navigator>
            </NavigationContainer>
            <StatusBar style="dark" />
        </SafeAreaView>
    );
}
