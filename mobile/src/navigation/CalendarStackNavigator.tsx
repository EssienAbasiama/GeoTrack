import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarScreen } from '../screens/CalendarScreen';
import { CalendarAttendanceScreen } from '../screens/CalendarAttendanceScreen';
import type { CalendarStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export function CalendarStackNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'ios_from_right',
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
                animationDuration: 320,
            }}
        >
            <Stack.Screen name="CalendarClasses" component={CalendarScreen} />
            <Stack.Screen name="CalendarAttendance" component={CalendarAttendanceScreen} />
        </Stack.Navigator>
    );
}
