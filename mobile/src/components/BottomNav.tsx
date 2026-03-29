import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface BottomNavProps {
    active: string;
    onNavigate: (screen: string) => void;
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
    return (
        <View className="absolute bottom-0 left-0 right-0">
            <View className="min-h-[94px] flex-row items-center justify-around rounded-t-[24px] bg-white px-2 py-5 shadow-sm shadow-black/5">
                <Pressable className="flex-1 items-center justify-center" onPress={() => onNavigate("home")}>
                    <Ionicons name="home" size={20} color={active === "home" ? "#6343cc" : "#B7BAC5"} />
                    <Text className={`mt-1 font-medium text-[12px] ${active === "home" ? "text-[#6343cc]" : "text-[#B7BAC5]"}`}>Home</Text>
                </Pressable>
                <Pressable className="flex-1 items-center justify-center" onPress={() => onNavigate("calendar")}>
                    <Ionicons name="calendar-outline" size={20} color={active === "calendar" ? "#6343cc" : "#B7BAC5"} />
                    <Text className={`mt-1 font-medium text-[12px] ${active === "calendar" ? "text-[#6343cc]" : "text-[#B7BAC5]"}`}>Calendar</Text>
                </Pressable>
                <Pressable className="flex-1 items-center justify-center" onPress={() => onNavigate("leave")}>
                    <Ionicons name="document-text-outline" size={20} color={active === "leave" ? "#6343cc" : "#B7BAC5"} />
                    <Text className={`mt-1 font-medium text-[12px] ${active === "leave" ? "text-[#6343cc]" : "text-[#B7BAC5]"}`}>Leave</Text>
                </Pressable>
                <Pressable className="flex-1 items-center justify-center" onPress={() => onNavigate("profile")}>
                    <Ionicons name="person-circle-outline" size={20} color={active === "profile" ? "#6343cc" : "#B7BAC5"} />
                    <Text className={`mt-1 font-medium text-[12px] ${active === "profile" ? "text-[#6343cc]" : "text-[#B7BAC5]"}`}>Profile</Text>
                </Pressable>
            </View>
        </View>
    );
}
