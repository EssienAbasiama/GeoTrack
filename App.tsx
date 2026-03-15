import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-base text-slate-900">NativeWind is set up 🎉</Text>
      <StatusBar style="auto" />
    </View>
  );
}
