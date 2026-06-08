import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { BottomNav } from '../components/BottomNav';

interface LeaveScreenProps {
    onNavigate: (screen: string) => void;
    activeScreen: string;
}

export function LeaveScreen({ onNavigate, activeScreen }: LeaveScreenProps) {
    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F6F6F9]">
            <View className="flex-1 items-center justify-center">
                <Text className="font-heading text-[32px] text-[#6343cc]">Leave</Text>
            </View>
            <BottomNav active={activeScreen} onNavigate={onNavigate} />
        </SafeAreaView>
    );
}
