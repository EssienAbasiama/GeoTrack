import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

/**
 * Root Stack Navigator Params
 * Defines all screens and their params at the root level of the navigation hierarchy
 */
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

/**
 * Main Tabs Navigator Params
 * Defines all tab screens accessible from the bottom tab navigation
 */
export type MainTabsParamList = {
  Home: undefined;
  Calendar: undefined;
  Profile: undefined;
};

/**
 * Calendar Stack Navigator Params
 * Nested stack inside the Calendar tab for class list and class attendance details
 */
export type CalendarStackParamList = {
  CalendarClasses: undefined;
  CalendarAttendance: {
    classId: string;
  };
};

/**
 * Composite navigation props for Root Stack
 * Use this type when a screen can be accessed from the Root Stack
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/**
 * Composite navigation props for Main Tabs
 * Use this type when a screen is a tab screen
 */
export type MainTabsScreenProps<T extends keyof MainTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

/**
 * Navigation prop type for Root Stack
 * Use in screens accessible from Root Stack for type-safe navigation
 */
type RootStackNavigationProp = NativeStackScreenProps<RootStackParamList>['navigation'];

/**
 * Navigation prop type for Tab screens
 * Use in tab screens for type-safe navigation
 */
type MainTabsNavigationProp = BottomTabScreenProps<MainTabsParamList>['navigation'];

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
