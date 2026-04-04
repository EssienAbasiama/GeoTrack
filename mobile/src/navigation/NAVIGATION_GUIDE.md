/\*\*

- NAVIGATION ARCHITECTURE GUIDE
-
- This document explains the refactored navigation structure
- implemented following React Native / React Navigation best practices.
  \*/

/\*\*

- STRUCTURE OVERVIEW
-
- App.tsx
- └─ RootNavigator (src/navigation/RootNavigator.tsx)
-       ├─ SplashScreen
-       ├─ OnboardingScreen
-       └─ MainTabsNavigator (src/navigation/MainTabsNavigator.tsx)
-           ├─ HomeScreen
-           ├─ CalendarScreen
-           └─ ProfileScreen
  \*/

/\*\*

- KEY FILES & RESPONSIBILITIES
  \*/

// 1. App.tsx
// ============================================================================
// The entry point. Kept minimal with only:
// - Font loading (@expo-google-fonts)
// - Navigation container setup
// - Safe area and status bar configuration
//
// WHY: Separation of concerns. App.tsx should only handle initialization.
// Navigation logic belongs elsewhere.

// 2. src/navigation/RootNavigator.tsx
// ============================================================================
// Manages the root-level navigation stack:
// Splash → Onboarding → MainApp
//
// Responsibilities:
// - Handle app initialization flow
// - Manage navigation state (splash/onboarding/authenticated)
// - Provide wrappers for screens that need navigation
//
// WHY: Centralizes app-level navigation flow. Easy to add authentication,
// feature flags, or other app-initialization logic later.

// 3. src/navigation/MainTabsNavigator.tsx
// ============================================================================
// Manages the bottom tab navigation for the main app.
//
// Key Features:
// - Centralized TAB_CONFIG object for styling (colors, spacing, shadows)
// - TAB_SCREENS array for screen configuration (icons, labels, etc.)
// - Dynamic tab rendering from TAB_SCREENS
//
// Why this matters:
// - Single source of truth for tab styling → easy theming changes
// - Adding a new tab is simple: add to TAB_SCREENS array
// - Icon configuration in one place
// - Easy to maintain consistency across all tabs

// 4. src/types/navigation.ts
// ============================================================================
// TypeScript type definitions for navigation.
//
// Defines:
// - RootStackParamList: Type for all root navigation screens
// - MainTabsParamList: Type for all tab screens
// - Screen-specific prop types (RootStackScreenProps, MainTabsScreenProps)
//
// WHY: Type safety. When navigating or accepting props, you get full
// intellisense and compile-time checking. No more runtime navigation errors.

/\*\*

- USAGE IN SCREENS
  \*/

// Example 1: A tab screen (HomeScreen)
// ============================================================================
import type { MainTabsScreenProps } from '../types/navigation';

type HomeScreenProps = MainTabsScreenProps<'Home'>;

export function HomeScreen({ navigation, route }: HomeScreenProps) {
// navigation has type safety - can only navigate to valid screens
return (
<Pressable onPress={() => navigation.navigate('Calendar')}>
{/_ ... _/}
</Pressable>
);
}

// Example 2: Root stack screen (OnboardingScreen)
// ============================================================================
import type { RootStackScreenProps } from '../types/navigation';

type OnboardingScreenProps = RootStackScreenProps<'Onboarding'>;

export function OnboardingScreen({ navigation, route }: OnboardingScreenProps) {
const handleGetStarted = () => {
navigation.replace('MainTabs'); // Type-safe navigation
};

return <View>{/_ ... _/}</View>;
}

/\*\*

- ADDING A NEW TAB SCREEN
  \*/

// 1. Add the screen to MainTabsParamList in src/types/navigation.ts:
// type MainTabsParamList = {
// Home: undefined;
// Calendar: undefined;
// Profile: undefined;
// NewFeature: undefined; // ← New screen
// };

// 2. Create the screen component (src/screens/NewFeatureScreen.tsx)

// 3. Add to TAB_SCREENS in src/navigation/MainTabsNavigator.tsx:
// {
// name: 'NewFeature',
// component: NewFeatureScreen,
// label: 'Feature',
// focusedIcon: 'star',
// unfocusedIcon: 'star-outline',
// }

// Done! The tab will automatically render with proper styling and icons.

/\*\*

- NAVIGATION PATTERNS
  \*/

// Pattern 1: Simple navigation between tabs
// ============================================================================
navigation.navigate('Calendar'); // Go to Calendar tab

// Pattern 2: Replace (clear navigation stack)
// ============================================================================
navigation.replace('MainTabs'); // Replace splash with main app

// Pattern 3: Reset navigation stack
// ============================================================================
navigation.reset({
index: 0,
routes: [{ name: 'Splash' }],
}); // Nuclear option - back to splash (logout scenario)

/\*\*

- STYLING & THEMING
  \*/

// All tab styling is centralized in TAB_CONFIG:
// - Colors: active/inactive/background/border
// - Spacing: horizontal, bottom, border radius, height
// - Shadow: color, opacity, radius, offset, elevation
// - Icon sizes

// To change theme: Update TAB_CONFIG in MainTabsNavigator.tsx
// Example: Change active color from purple to blue
//
// const TAB_CONFIG = {
// colors: {
// active: '#0066ff', // ← Changed
// inactive: '#B7BAC5',
// ...
// },
// ...
// }

/\*\*

- BEST PRACTICES IMPLEMENTED
  \*/

// ✅ Type Safety
// All navigation props are fully typed. No more `any` anywhere.
// Full intellisense support in IDEs.

// ✅ Separation of Concerns
// - App.tsx: Initialization only
// - RootNavigator: App-level flow
// - MainTabsNavigator: Tab management
// - Types: All navigation types in one place

// ✅ Maintainability
// - Centralized config (TAB_CONFIG, TAB_SCREENS)
// - Easy to add/remove tabs
// - Easy to change styling globally
// - Comments explain "why" not just "what"

// ✅ Scalability
// - Easy to add nested navigation within tabs
// - Easy to add modal screens on top of tabs
// - Easy to add authentication flow
// - Easy to add deep linking

// ✅ Performance
// - No unnecessary re-renders
// - Proper screen lifecycle management
// - No prop drilling

/\*\*

- NEXT STEPS
  \*/

// 1. Update screen component imports if needed
// 2. Test navigation flow: Splash → Onboarding → Home/Calendar/Profile
// 3. If you need to add nested navigation within tabs:
// - Create new navigators in src/navigation/
// - Add param types to MainTabsParamList
// - Follow same structure as MainTabsNavigator

// 4. When adding authentication:
// - Create useAuth hook  
// - Use it in RootNavigator to conditionally show authenticated/unauthenticated screens
// - This follows the same pattern used for splash/onboarding states

// 5. For deep linking:
// - Add linking config to NavigationContainer in App.tsx
// - Define deep link route structure
// - Test with: npx uri-scheme open "myapp://home" --android

/\*\*

- DEPRECATED
  \*/

// src/components/BottomNav.tsx is now redundant.
// React Navigation's built-in tab navigation is being used.
// You can delete it or keep it if used elsewhere.
