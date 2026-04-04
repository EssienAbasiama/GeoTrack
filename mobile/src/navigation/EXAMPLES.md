/\*\*

- PRACTICAL NAVIGATION EXAMPLES
-
- Copy-paste examples for common navigation patterns in your screens.
  \*/

/\*\*

- EXAMPLE 1: Tab Screen with Navigation
-
- How to navigate between tabs from a tab screen
  \*/
  import React from 'react';
  import { Pressable, Text, View } from 'react-native';
  import { Ionicons } from '@expo/vector-icons';
  import type { MainTabsScreenProps } from '../types/navigation';

type HomeScreenProps = MainTabsScreenProps<'Home'>;

export function HomeScreenExample({ navigation }: HomeScreenProps) {
return (
<View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
{/_ Navigate to Calendar tab _/}
<Pressable
onPress={() => navigation.navigate('Calendar')}
style={{
          backgroundColor: '#6343cc',
          padding: 16,
          borderRadius: 8,
          marginBottom: 12,
        }} >
<Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
Go to Calendar
</Text>
</Pressable>

      {/* Navigate to Profile tab */}
      <Pressable
        onPress={() => navigation.navigate('Profile')}
        style={{
          backgroundColor: '#6343cc',
          padding: 16,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          Go to Profile
        </Text>
      </Pressable>
    </View>

);
}

/\*\*

- EXAMPLE 2: Using useNavigation Hook
-
- If you can't pass navigation props due to component structure,
- use the useNavigation hook
  \*/
  import { useNavigation } from '@react-navigation/native';
  import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// For tab screens:
type TabNavigationProp = NativeStackNavigationProp<
any, // Use your actual MainTabsParamList here
'Home'

> ;

function HomeButton() {
const navigation = useNavigation<TabNavigationProp>();

return (
<Pressable onPress={() => navigation.navigate('Calendar')}>
<Ionicons name="calendar-outline" size={24} color="black" />
</Pressable>
);
}

/\*\*

- EXAMPLE 3: Root Stack Screen Transition
-
- How to handle transitions in screens accessed from root stack
  \*/
  import type { RootStackScreenProps } from '../types/navigation';

type SplashScreenProps = RootStackScreenProps<'Splash'>;

export function SplashScreenExample({ navigation }: SplashScreenProps) {
React.useEffect(() => {
// Simulate splash delay
const timeout = setTimeout(() => {
navigation.replace('Onboarding'); // Replace to prevent back navigation
}, 2000);

    return () => clearTimeout(timeout);

}, [navigation]);

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Ionicons name="logo-ionic" size={64} color="#6343cc" />
</View>
);
}

/\*\*

- EXAMPLE 4: Conditional Navigation (Authentication)
-
- How to implement navigation based on app state
- (This goes in RootNavigator.tsx)
  \*/
  import { useState, useEffect } from 'react';

function RootNavigatorWithAuth() {
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [isReady, setIsReady] = useState(false);

useEffect(() => {
// Check if user is logged in (from storage, API, etc.)
const checkAuth = async () => {
// TODO: Check auth state
setIsLoggedIn(false);
setIsReady(true);
};

    checkAuth();

}, []);

if (!isReady) {
return null; // Show splash screen
}

// Conditional rendering based on auth state
if (!isLoggedIn) {
return (
<Stack.Navigator>
<Stack.Screen name="Splash" component={SplashWrapper} />
<Stack.Screen name="Onboarding" component={OnboardingWrapper} />
</Stack.Navigator>
);
}

return (
<Stack.Navigator>
<Stack.Screen name="MainTabs" component={MainTabsNavigator} />
</Stack.Navigator>
);
}

/\*\*

- EXAMPLE 5: Navigation with Parameters
-
- How to pass data between screens
  \*/

// Step 1: Define param types in src/types/navigation.ts:
// type MainTabsParamList = {
// Home: undefined;
// Profile: { userId: string };
// Calendar: undefined;
// };

// Step 2: Navigate with params:
function ProfileButtonWithParams() {
const navigation = useNavigation();

return (
<Pressable
onPress={() => {
// Pass userId to Profile screen
navigation.navigate('Profile', { userId: '12345' });
}} >
<Text>View Profile</Text>
</Pressable>
);
}

// Step 3: Access params in the destination screen:
type ProfileScreenProps = MainTabsScreenProps<'Profile'>;

function ProfileScreenWithParams({ route }: ProfileScreenProps) {
const { userId } = route.params; // Type-safe access to params

return (
<View>
<Text>Profile for user: {userId}</Text>
</View>
);
}

/\*\*

- EXAMPLE 6: Tab Navigation Lifecycle
-
- How to run code when tabs focus/blur
  \*/
  import { useFocusEffect } from '@react-navigation/native';

type CalendarScreenProps = MainTabsScreenProps<'Calendar'>;

export function CalendarScreenWithLifecycle({
navigation,
}: CalendarScreenProps) {
// This runs when the Calendar tab comes into focus
useFocusEffect(
React.useCallback(() => {
// TODO: Load calendar data
console.log('Calendar tab focused - load events');

      // Optional: cleanup when tab loses focus
      return () => {
        console.log('Calendar tab blurred');
      };
    }, [])

);

return <View>{/_ ... _/}</View>;
}

/\*\*

- EXAMPLE 7: Nested Navigation within a Tab
-
- If you need a stack navigator within a tab (e.g., Home tab with detail screens)
-
- Structure:
- MainTabsNavigator
- └─ HomeStack (new!)
-       ├─ HomeList
-       └─ ItemDetail
- └─ Calendar
- └─ Profile
  \*/

// Create src/navigation/HomeStackNavigator.tsx:
function HomeStackNavigator() {
const HomeStack = createNativeStackNavigator();

return (
<HomeStack.Navigator screenOptions={{ headerShown: false }}>
<HomeStack.Screen
name="HomeList"
component={HomeListScreen}
options={{ title: 'Home' }}
/>
<HomeStack.Screen
name="ItemDetail"
component={ItemDetailScreen}
options={{ title: 'Details' }}
/>
</HomeStack.Navigator>
);
}

// Then update MainTabsNavigator:
// <Tab.Screen
// name="Home"
// component={HomeStackNavigator} // Use nested stack instead
// options={{ tabBarLabel: 'Home' }}
// />

/\*\*

- EXAMPLE 8: Navigate and Reset (Logout Scenario)
-
- How to clear navigation stack and go back to login
  \*/
  function LogoutExample() {
  const navigation = useNavigation();

const handleLogout = () => {
// Clear all navigation history and go back to splash
navigation.reset({
index: 0,
routes: [{ name: 'Splash' }],
});
};

return (
<Pressable onPress={handleLogout}>
<Text>Logout</Text>
</Pressable>
);
}

/\*\*

- EXAMPLE 9: Get Current Route Name
-
- How to know which screen is currently active
  \*/
  function NavigationDebugger() {
  const navigation = useNavigation();
  const route = useRoute();

useEffect(() => {
const unsubscribe = navigation.addListener('state', () => {
console.log('Navigation state changed:', navigation.getState());
});

    return unsubscribe;

}, [navigation]);

return (
<View>
<Text>Current route: {route.name}</Text>
</View>
);
}

/\*\*

- EXAMPLE 10: Deep Linking Configuration
-
- Add to App.tsx for deep linking support
  \*/
  const linking = {
  prefixes: ['myapp://', 'https://myapp.com'],
  config: {
  screens: {
  Splash: 'splash',
  Onboarding: 'onboarding',
  MainTabs: {
  screens: {
  Home: 'home',
  Calendar: 'calendar',
  Profile: 'profile/:userId',
  },
  },
  },
  },
  };

// Usage:
// <NavigationContainer linking={linking}>
// <RootNavigator />
// </NavigationContainer>

// Now these URLs work:
// myapp://home
// myapp://profile/123
// https://myapp.com/profile/456
