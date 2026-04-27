import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore is only available on iOS and Android
const isAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

// Fallback for web builds during development
const memoryFallback: Record<string, string> = {};

async function storeGet(key: string): Promise<string | null> {
    if (isAvailable) return SecureStore.getItemAsync(key);
    return memoryFallback[key] ?? null;
}

async function storeSet(key: string, value: string): Promise<void> {
    if (isAvailable) {
        await SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
    } else {
        memoryFallback[key] = value;
    }
}

async function storeDelete(key: string): Promise<void> {
    if (isAvailable) {
        await SecureStore.deleteItemAsync(key);
    } else {
        delete memoryFallback[key];
    }
}

const KEYS = {
    ACCESS_TOKEN: 'geotrack_access_token',
    REFRESH_TOKEN: 'geotrack_refresh_token',
    USER_DATA: 'geotrack_user_data',
} as const;

export const getAccessToken = () => storeGet(KEYS.ACCESS_TOKEN);
export const setAccessToken = (token: string) => storeSet(KEYS.ACCESS_TOKEN, token);
export const removeAccessToken = () => storeDelete(KEYS.ACCESS_TOKEN);

export const getRefreshToken = () => storeGet(KEYS.REFRESH_TOKEN);
export const setRefreshToken = (token: string) => storeSet(KEYS.REFRESH_TOKEN, token);
export const removeRefreshToken = () => storeDelete(KEYS.REFRESH_TOKEN);

export const getUserData = async <T = Record<string, unknown>>(): Promise<T | null> => {
    const raw = await storeGet(KEYS.USER_DATA);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};
export const setUserData = (data: object) => storeSet(KEYS.USER_DATA, JSON.stringify(data));
export const removeUserData = () => storeDelete(KEYS.USER_DATA);

/** Clear all authentication-related keys from secure storage */
export const clearAuthStorage = () =>
    Promise.all([
        storeDelete(KEYS.ACCESS_TOKEN),
        storeDelete(KEYS.REFRESH_TOKEN),
        storeDelete(KEYS.USER_DATA),
    ]);

// Legacy aliases kept for backwards compatibility
export const getToken = getAccessToken;
export const clearAll = clearAuthStorage;
