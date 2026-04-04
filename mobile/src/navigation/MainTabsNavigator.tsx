import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MainTabsParamList } from '../types/navigation';
import { HomeScreen } from '../screens/HomeScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const PRIMARY_COLOR = '#6343cc';
const INACTIVE_COLOR = '#9CA3AF';
const COLLAPSED_TAB_WIDTH = 52;
const EXPANDED_TAB_WIDTH = 122;
const TAB_GAP = 8;

const styles = StyleSheet.create({
    barFrame: {
        position: 'absolute',
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
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
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
        zIndex: 0,
        elevation: 0,
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
                {isFocused ? (
                    <Text style={styles.activeLabel}>{tabConfig.label}</Text>
                ) : null}
            </Pressable>
        </Animated.View>
    );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
    const indicatorLeft = useRef(new Animated.Value(0)).current;
    const indicatorWidth = useRef(new Animated.Value(EXPANDED_TAB_WIDTH)).current;
    const hasInitialized = useRef(false);

    const tabCount = state.routes.length;
    const trackWidth =
        COLLAPSED_TAB_WIDTH * Math.max(tabCount - 1, 0) +
        EXPANDED_TAB_WIDTH +
        TAB_GAP * Math.max(tabCount - 1, 0);
    const barWidth = trackWidth + 16;

    const activeRouteKey = state.routes[state.index]?.key;
    const activeLayout = activeRouteKey ? tabLayouts[activeRouteKey] : undefined;

    useEffect(() => {
        if (!activeLayout) return;

        const targetLeft = activeLayout.x;
        const targetWidth = activeLayout.width;

        if (!hasInitialized.current) {
            indicatorLeft.setValue(targetLeft);
            indicatorWidth.setValue(targetWidth);
            hasInitialized.current = true;
            return;
        }

        Animated.parallel([
            Animated.spring(indicatorLeft, {
                toValue: targetLeft,
                useNativeDriver: false,
                speed: 20,
                bounciness: 9,
            }),
            Animated.spring(indicatorWidth, {
                toValue: targetWidth,
                useNativeDriver: false,
                speed: 20,
                bounciness: 6,
            }),
        ]).start();
    }, [activeLayout, indicatorLeft, indicatorWidth]);

    const onSlotLayout = (routeKey: string) => (event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        setTabLayouts((prev) => {
            const existing = prev[routeKey];
            if (existing && existing.x === x && existing.width === width) {
                return prev;
            }
            return {
                ...prev,
                [routeKey]: { x, width },
            };
        });
    };

    return (
        <View
            style={[
                styles.barFrame,
                {
                    bottom: 10,
                    alignSelf: 'center',
                    width: barWidth,
                },
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
                    <View style={styles.row}>
                        {activeLayout ? (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.activeSwitch,
                                    {
                                        left: indicatorLeft,
                                        width: indicatorWidth,
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
                                    style={[
                                        styles.slot,
                                        {
                                            width: isFocused ? EXPANDED_TAB_WIDTH : COLLAPSED_TAB_WIDTH,
                                            marginHorizontal: TAB_GAP / 2,
                                        },
                                    ]}
                                    onLayout={onSlotLayout(route.key)}
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
