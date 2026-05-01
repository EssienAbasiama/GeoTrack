import React from "react";
import { View, Text, Pressable } from "react-native";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
} from "lucide-react-native";

const BaseToast = ({ icon: Icon, iconColor, text1 }) => (
    <View className="bg-[#1C1C1C] w-[90%] px-4 py-4 rounded-xl mx-4 mb-8 flex-row justify-between items-center">
        <View className="flex-row items-center space-x-3 font-sans">
            <Icon size={18} color={iconColor} />
            <Text className="text-white text-[11px] font-[Poppins-Medium]">
                {text1}
            </Text>
        </View>
    </View>
);

const toastConfig = {
    success: ({ text1 }) => (
        <BaseToast icon={CheckCircle2} iconColor="#4CAF50" text1={text1} />
    ),
    error: ({ text1 }) => (
        <BaseToast icon={XCircle} iconColor="#F44336" text1={text1} />
    ),
    warning: ({ text1 }) => (
        <BaseToast icon={AlertTriangle} iconColor="#FFC107" text1={text1} />
    ),
    info: ({ text1 }) => (
        <BaseToast icon={Info} iconColor="#2196F3" text1={text1} />
    ),
};

export default toastConfig;
