import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Hidden "Simulation mode" flag. When on, the app skips the live face-capture
// step at check-in and tells the backend to treat identity as verified
// (see config/geotrack.php `demo_mode`). Persisted locally so it survives
// restarts. Kept intentionally simple — one boolean, no server round-trip.

const KEY = 'geotrack_demo_mode';
const isAvailable = Platform.OS === 'ios' || Platform.OS === 'android';
let cached: boolean | null = null;

export async function getDemoMode(): Promise<boolean> {
    if (cached !== null) return cached;
    try {
        const raw = isAvailable ? await SecureStore.getItemAsync(KEY) : null;
        cached = raw === '1';
    } catch {
        cached = false;
    }
    return cached;
}

export async function setDemoMode(enabled: boolean): Promise<void> {
    cached = enabled;
    try {
        if (!isAvailable) return;
        if (enabled) {
            await SecureStore.setItemAsync(KEY, '1', {
                keychainAccessible: SecureStore.WHEN_UNLOCKED,
            });
        } else {
            await SecureStore.deleteItemAsync(KEY);
        }
    } catch {
        // best-effort; cached value still reflects the intent for this session
    }
}
