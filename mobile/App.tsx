import { useFonts, WorkSans_300Light, WorkSans_400Regular, WorkSans_500Medium, WorkSans_700Bold } from '@expo-google-fonts/work-sans';
import { Text, View } from 'react-native';
import "./global.css";

export default function App() {
    const [fontsLoaded] = useFonts({
        WorkSans_300Light,
        WorkSans_400Regular,
        WorkSans_500Medium,
        WorkSans_700Bold,
    });

    if (!fontsLoaded) return null;

    return (
        <View className="flex-1 justify-center items-center">
            <Text className="font-sans text-base">Hello World</Text>
        </View>
    );
}