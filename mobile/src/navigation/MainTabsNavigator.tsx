import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabsParamList } from '../types/navigation';
import { HomeScreen } from '../screens/HomeScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const PRIMARY_COLOR = '#6343cc';
const INACTIVE_COLOR = '#9CA3AF';

const styles = StyleSheet.create({
    barFrame: {
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    barShell: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        overflow: 'hidden',
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    barInner: {
        position: 'relative',
        zIndex: 2,
        padding: 6,
    },
    row: {
        height: 48,
        paddingHorizontal: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    slot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButton: {
        width: '100%',
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    activeSwitch: {
        position: 'absolute',
        top: 2,
        height: 44,
        borderRadius: 22,
        backgroundColor: PRIMARY_COLOR,
        shadowColor: PRIMARY_COLOR,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    activeLabel: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

/**
 * Tab screens configuration
 * Centralized definition of all tab screens with their icons and labels
 */
const TAB_SCREENS = [
    {
        name: 'Home' as const,
        component: HomeScreen,
        label: 'Home',
        focusedIcon: 'home',
        unfocusedIcon: 'home-outline',
    },
    {
        name: 'Calendar' as const,
        component: CalendarScreen,
        label: 'Calendar',
        focusedIcon: 'stats-chart',
        unfocusedIcon: 'stats-chart-outline',
    },
    {
        name: 'Profile' as const,
        component: ProfileScreen,
        label: 'Profile',
        focusedIcon: 'person',
        unfocusedIcon: 'person-outline',
    },
];

type TabConfig = (typeof TAB_SCREENS)[number];

function TabBarItem({
    routeKey,
    isFocused,
    tabConfig,
    onPress,
}: {
    routeKey: string;
    isFocused: boolean;
    tabConfig: TabConfig;
    onPress: () => void;
}) {
    const pressScale = useRef(new Animated.Value(1)).current;
    const focusLift = useRef(new Animated.Value(isFocused ? -1 : 0)).current;

    useEffect(() => {
        Animated.spring(focusLift, {
            toValue: isFocused ? -1 : 0,
            useNativeDriver: true,
            speed: 18,
            bounciness: 6,
        }).start();
    }, [isFocused, focusLift]);

    const handlePressIn = () => {
        Animated.timing(pressScale, {
            toValue: 0.95,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.timing(pressScale, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();
    };

    const iconName = isFocused ? tabConfig.focusedIcon : tabConfig.unfocusedIcon;

    return (
        <Animated.View
            style={{
                transform: [{ scale: pressScale }, { translateY: focusLift }],
                width: '100%',
            }}
        >
            <Pressable
                key={routeKey}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.tabButton}
            >
                <Ionicons
                    name={iconName}
                    size={20}
                    color={isFocused ? '#FFFFFF' : INACTIVE_COLOR}
                />
                <Text
                    style={[
                        styles.activeLabel,
                        {
                            transform: [{ scale: isFocused ? 1 : 0.8 }],
                            opacity: isFocused ? 1 : 0,
                        },
                    ]}
                >
                    {tabConfig.label}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const [rowWidth, setRowWidth] = useState(0);
    const indicatorX = useRef(new Animated.Value(0)).current;

    const indicatorWidth = 90;
    const tabWidth = rowWidth > 0 ? rowWidth / state.routes.length : 0;

    useEffect(() => {
        if (!tabWidth) return;

        const targetX =
            tabWidth * state.index + (tabWidth - indicatorWidth) / 2;

        const timeout = setTimeout(() => {
            Animated.spring(indicatorX, {
                toValue: targetX,
                useNativeDriver: true,
                speed: 18,
                bounciness: 7,
            }).start();
        }, 50);

        return () => clearTimeout(timeout);
    }, [state.index, tabWidth]);

    const onRowLayout = (event: LayoutChangeEvent) => {
        setRowWidth(event.nativeEvent.layout.width);
    };

    return (
        <View
            style={[
                styles.barFrame,
                { bottom: Math.max(insets.bottom, 10) },
            ]}
        >
            <BlurView intensity={58} tint="light" style={styles.barShell}>
                <LinearGradient
                    colors={[
                        'rgba(255, 255, 255, 0.34)',
                        'rgba(255, 255, 255, 0.16)',
                        'rgba(255, 255, 255, 0.06)',
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.glassOverlay}
                />
                <View style={styles.barInner}>
                    <View style={styles.row} onLayout={onRowLayout}>
                        {indicatorWidth > 0 ? (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.activeSwitch,
                                    {
                                        width: indicatorWidth,
                                        transform: [{ translateX: indicatorX }],
                                    },
                                ]}
                            />
                        ) : null}
                        {state.routes.map((route, index) => {
                            const isFocused = state.index === index;
                            const tabConfig = TAB_SCREENS.find((tab) => tab.name === route.name);
                            if (!tabConfig) return null;

                            const onPress = () => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name);
                                }
                            };

                            return (
                                <View
                                    key={route.key}
                                    style={styles.slot}
                                >
                                    <TabBarItem
                                        routeKey={route.key}
                                        isFocused={isFocused}
                                        tabConfig={tabConfig}
                                        onPress={onPress}
                                    />
                                </View>
                            );
                        })}
                    </View>
                </View>
            </BlurView>
        </View>
    );
}

/**
 * MainTabsNavigator
 * 
 * Bottom tab navigation with pill-shaped active tab styling
 * Active tab has a colored background, inactive tabs are just icons
 */
export function MainTabsNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
            }}
            tabBar={(props) => <CustomTabBar {...props} />}
        >
            {TAB_SCREENS.map((screen) => (
                <Tab.Screen
                    key={screen.name}
                    name={screen.name}
                    component={screen.component}
                    options={{
                        tabBarLabel: screen.label,
                    }}
                />
            ))}
        </Tab.Navigator>
    );
}
