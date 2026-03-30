import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export function CalendarScreen() {
    const attendance = [
        { day: 11, checkIn: "10:02 AM", checkOut: "-- : --", total: "07:20h", active: true },
        { day: 10, checkIn: "10:00 AM", checkOut: "07:00 PM", total: "09:00h" },
        { day: 9, checkIn: "10:10 AM", checkOut: "06:20 PM", total: "08:10h" },
    ];

    return (
        <SafeAreaView className="flex-1 bg-[#F6F6F9] px-5 pt-3">
            <View className="flex-1 pb-[110px]">
                <Text className="font-heading text-[22px] text-[#181A20] text-center mt-2 mb-4">Attendance Calendar</Text>
                {/* Calendar Month Selector */}
                <View className="flex-row items-center justify-between bg-white rounded-[16px] px-4 py-3 mb-4">
                    <Ionicons name="chevron-back" size={20} color="#B7BAC5" />
                    <Text className="font-medium text-[16px] text-[#181A20]">September, 2025</Text>
                    <Ionicons name="chevron-forward" size={20} color="#B7BAC5" />
                </View>
                {/* Calendar Days Row */}
                <View className="flex-row justify-between mb-2 px-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <View key={i} className="w-8 items-center justify-center">
                            <Text className={`text-center text-[13px] font-medium ${d === "F" ? "text-[#F75555]" : "text-[#181A20]"}`}>{d}</Text>
                        </View>
                    ))}
                </View>
                <View className="flex-row justify-between mb-4 px-2">
                    {[7, 8, 9, 10, 11, 12, 13].map((d, i) => (
                        <View key={i} className="w-8 h-8 items-center justify-center">
                            <View className={`${d === 11 ? "bg-[#6343cc] rounded-full w-8 h-8 items-center justify-center" : ""} flex items-center justify-center`}>
                                <Text className={`text-[15px] font-medium ${d === 11 ? "text-white" : d === 12 || d === 13 ? "text-[#F75555]" : "text-[#181A20]"}`}
                                    style={d === 11 ? { lineHeight: 32, textAlign: 'center' } : {}}>{d}</Text>
                            </View>
                        </View>
                    ))}
                </View>
                {/* Monthly Summary */}
                <View className="flex-row justify-between mb-4">
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 mr-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="close-circle" size={18} color="#F75555" />
                            <Text className="ml-2 text-[#F75555] font-bold text-[13px]">Absence</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">03</Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-[16px] px-4 py-4 ml-2 items-center">
                        <View className="flex-row items-center mb-1">
                            <Ionicons name="checkmark-circle" size={18} color="#6343cc" />
                            <Text className="ml-2 text-[#6343cc] font-bold text-[13px]">Attendance</Text>
                        </View>
                        <Text className="font-heading text-[28px] text-[#181A20]">15</Text>
                        <Text className="text-[#B7BAC5] text-[13px]">Days</Text>
                    </View>
                </View>
                {/* Your Attendance */}
                <Text className="font-heading text-[15px] text-[#181A20] mb-2">Your Attendance</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {attendance.map((item, idx) => (
                        <View
                            key={item.day}
                            className={`flex-row items-center mb-3 rounded-[16px] ${item.active ? "bg-[#6343cc]" : "bg-white"} px-4 py-5`}
                        >
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${item.active ? "bg-white" : "bg-[#ECE9FA]"}`}>
                                <Text className={`font-heading text-[16px] ${item.active ? "text-[#6343cc]" : "text-[#181A20]"}`}
                                    style={{ lineHeight: 32, textAlign: 'center' }}>{item.day}</Text>
                            </View>
                            <View className="flex-1 flex-row justify-between ml-4">
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? "text-white" : "text-[#B7BAC5]"}`}>Check In</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? "text-white" : "text-[#181A20]"}`}>{item.checkIn}</Text>
                                </View>
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? "text-white" : "text-[#B7BAC5]"}`}>Check Out</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? "text-white" : "text-[#181A20]"}`}>{item.checkOut}</Text>
                                </View>
                                <View className="items-center">
                                    <Text className={`text-[12px] ${item.active ? "text-white" : "text-[#B7BAC5]"}`}>Total Hour</Text>
                                    <Text className={`font-bold text-[15px] ${item.active ? "text-white" : "text-[#181A20]"}`}>{item.total}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
