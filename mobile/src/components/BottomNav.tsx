import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface BottomNavProps {
    active: string;
    onNavigate: (screen: string) => void;
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
    return (
        <View style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            borderRadius: 24,
            backgroundColor: 'rgba(255, 255, 255, 0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.5)',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 16,
            elevation: 10,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 14,
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                <Pressable onPress={() => onNavigate('home')} style={{ alignItems: 'center', flex: 1 }}>
                    <Ionicons name="home" size={22} color={active === 'home' ? '#6343cc' : '#BCC1CC'} />
                    <Text style={{ marginTop: 2, fontSize: 11, color: active === 'home' ? '#6343cc' : '#BCC1CC' }}>Home</Text>
                </Pressable>
                <Pressable onPress={() => onNavigate('calendar')} style={{ alignItems: 'center', flex: 1 }}>
                    <Ionicons name="calendar-outline" size={22} color={active === 'calendar' ? '#6343cc' : '#BCC1CC'} />
                    <Text style={{ marginTop: 2, fontSize: 11, color: active === 'calendar' ? '#6343cc' : '#BCC1CC' }}>Calendar</Text>
                </Pressable>
                <Pressable onPress={() => onNavigate('profile')} style={{ alignItems: 'center', flex: 1 }}>
                    <Ionicons name="person-circle-outline" size={22} color={active === 'profile' ? '#6343cc' : '#BCC1CC'} />
                    <Text style={{ marginTop: 2, fontSize: 11, color: active === 'profile' ? '#6343cc' : '#BCC1CC' }}>Profile</Text>
                </Pressable>
            </View>
        </View>
    );
}
