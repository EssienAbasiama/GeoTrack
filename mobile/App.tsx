import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
  useFonts,
} from '@expo-google-fonts/work-sans';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  FadeOutUp,
  SlideInRight,
  SlideOutLeft,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  title: string;
  description: string;
};

const slides: Slide[] = [
  {
    id: 'discover',
    title: 'Smarter Way to Attend',
    description:
      'Mark attendance in seconds using live location and secure QR validation.',
  },
  {
    id: 'realtime',
    title: 'Real-Time Presence Insights',
    description:
      'Track who is in, late, or missing with clean analytics built for teams.',
  },
  {
    id: 'secure',
    title: 'Private, Accurate, Reliable',
    description:
      'Built with geo-fencing and smart verification to keep attendance authentic.',
  },
];

const orbitUsers = [
  { top: 18, left: 22, color: '#81D4FA', initials: 'AB' },
  { top: 24, right: 14, color: '#FFCC80', initials: 'NT' },
  { top: 53, left: 12, color: '#B39DDB', initials: 'MW' },
  { top: 57, right: 10, color: '#80DEEA', initials: 'KT' },
  { top: 74, left: 40, color: '#A5D6A7', initials: 'YO' },
  { top: 72, right: 36, color: '#EF9A9A', initials: 'DS' },
];

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <View
      style={[
        styles.logoBox,
        large ? styles.logoBoxLarge : styles.logoBoxSmall,
        large ? styles.deepShadow : styles.softShadow,
      ]}
    >
      <Text style={[styles.logoGlyph, large ? styles.logoGlyphLarge : styles.logoGlyphSmall]}>g</Text>
    </View>
  );
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  const pulse = useSharedValue(0.92);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, {
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      true,
    );

    glow.value = withRepeat(
      withTiming(1, {
        duration: 1300,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [glow, onDone, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: glow.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOutUp.duration(500)}
      className="flex-1 items-center justify-center bg-[#F5F4F8]"
    >
      <View className="items-center">
        <Animated.View style={[styles.pulseRing, ringStyle]} />
        <View className="absolute inset-0 items-center justify-center">
          <BrandMark large />
        </View>
      </View>
      <Text style={styles.brandTitle}>cotap</Text>
      <Text style={styles.brandSubtitle}>attendance reimagined</Text>
    </Animated.View>
  );
}

function DotIndicator({ index, scrollX, isActive }: { index: number; scrollX: Animated.SharedValue<number>; isActive: boolean }) {
  const dotStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / width - index);
    return {
      width: interpolate(distance, [0, 1], [24, 8]),
      opacity: interpolate(distance, [0, 1], [1, 0.4]),
    };
  });

  return <Animated.View style={[styles.dotBase, isActive ? styles.dotActive : styles.dotIdle, dotStyle]} />;
}

function OnboardingScreen() {
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  const goToNext = () => {
    const next = Math.min(activeIndex + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  const renderItem: ListRenderItem<Slide> = ({ item }) => {
    return (
      <View style={{ width }} className="px-6">
        <View className="mt-8 items-center">
          <View style={styles.orbitOuter}>
            <View style={styles.orbitMiddle}>
              <View style={styles.orbitInner}>
                <BrandMark />
              </View>
            </View>

            {orbitUsers.map((user, idx) => (
              <View
                key={`${item.id}-${idx}`}
                style={[
                  styles.userDot,
                  {
                    backgroundColor: user.color,
                    top: `${user.top}%`,
                    left: user.left ? `${user.left}%` : undefined,
                    right: user.right ? `${user.right}%` : undefined,
                  },
                ]}
              >
                <Text style={styles.userInitials}>{user.initials}</Text>
              </View>
            ))}
          </View>
        </View>

        <Animated.View
          key={item.id}
          entering={SlideInRight.springify().damping(16)}
          exiting={SlideOutLeft.duration(250)}
          className="mt-12 px-3"
        >
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F5F4F8]">
      <View className="flex-1">
        <Text style={styles.topBrand}>cotap</Text>

        <Animated.FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
        />

        <View className="mb-8 mt-3 items-center">
          <View className="mb-8 flex-row items-center gap-2">
            {slides.map((slide, index) => (
              <DotIndicator key={slide.id} index={index} scrollX={scrollX} isActive={index === activeIndex} />
            ))}
          </View>

          <Pressable onPress={goToNext} style={styles.ctaButton}>
            <Text style={styles.ctaText}>{activeIndex === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'onboarding'>('splash');
  const [fontsLoaded] = useFonts({
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F4F8]">
        <ActivityIndicator size="large" color="#5B3DF5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F4F8]">
      {phase === 'splash' ? (
        <SplashScreen onDone={() => setPhase('onboarding')} />
      ) : (
        <Animated.View entering={FadeIn.duration(450)} exiting={FadeOut.duration(250)} className="flex-1">
          <OnboardingScreen />
        </Animated.View>
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#7A63FF',
  },
  logoBox: {
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B3DF5',
  },
  logoBoxLarge: {
    width: 120,
    height: 120,
  },
  logoBoxSmall: {
    width: 92,
    height: 92,
  },
  logoGlyph: {
    color: '#ffffff',
    marginTop: -2,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: 'WorkSans_700Bold',
  },
  logoGlyphLarge: {
    fontSize: 74,
    lineHeight: 74,
  },
  logoGlyphSmall: {
    fontSize: 58,
    lineHeight: 58,
  },
  brandTitle: {
    marginTop: 40,
    fontSize: 36,
    lineHeight: 42,
    color: '#191825',
    fontFamily: 'WorkSans_700Bold',
  },
  brandSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6C7082',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontFamily: 'WorkSans_500Medium',
  },
  topBrand: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 36,
    color: '#181A22',
    fontFamily: 'WorkSans_700Bold',
  },
  orbitOuter: {
    width: 320,
    height: 320,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9EAF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitMiddle: {
    width: 250,
    height: 250,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9EAF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitInner: {
    width: 175,
    height: 175,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9EAF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInitials: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'WorkSans_600SemiBold',
  },
  slideTitle: {
    textAlign: 'center',
    fontSize: 32,
    lineHeight: 38,
    color: '#171923',
    fontFamily: 'WorkSans_700Bold',
  },
  slideDescription: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    color: '#72788A',
    paddingHorizontal: 14,
    fontFamily: 'WorkSans_400Regular',
  },
  dotBase: {
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: '#5B3DF5',
  },
  dotIdle: {
    backgroundColor: '#D7D9E4',
  },
  ctaButton: {
    height: 56,
    width: width - 48,
    borderRadius: 18,
    backgroundColor: '#5B3DF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'WorkSans_600SemiBold',
  },
  softShadow: {
    shadowColor: '#3D29B7',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  deepShadow: {
    shadowColor: '#3D29B7',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
});
