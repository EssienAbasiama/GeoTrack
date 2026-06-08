import React from "react";
import { View, Text } from "react-native";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
} from "lucide-react-native";
import type { ToastConfig, ToastConfigParams } from "react-native-toast-message";

type BaseToastProps = {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    iconColor: string;
    text1?: string;
};

const BaseToast = ({ icon: Icon, iconColor, text1 }: BaseToastProps) => (
    <View className="bg-[#1C1C1C] w-[90%] px-4 py-4 rounded-xl mx-4 mb-8 flex-row justify-between items-center">
        <View className="flex-row items-center space-x-3 font-sans">
            <Icon size={18} color={iconColor} />
            <Text className="text-white text-[11px] font-medium">
                {text1}
            </Text>
        </View>
    </View>
);

const toastConfig: ToastConfig = {
    success: ({ text1 }: ToastConfigParams<any>) => (
        <BaseToast icon={CheckCircle2} iconColor="#4CAF50" text1={text1} />
    ),
    error: ({ text1 }: ToastConfigParams<any>) => (
        <BaseToast icon={XCircle} iconColor="#F44336" text1={text1} />
    ),
    warning: ({ text1 }: ToastConfigParams<any>) => (
        <BaseToast icon={AlertTriangle} iconColor="#FFC107" text1={text1} />
    ),
    info: ({ text1 }: ToastConfigParams<any>) => (
        <BaseToast icon={Info} iconColor="#2196F3" text1={text1} />
    ),
};

export default toastConfig;
