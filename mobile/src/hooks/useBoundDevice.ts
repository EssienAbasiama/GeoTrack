import { useCallback, useEffect, useState } from 'react';
import { deviceApi } from '../services/apiClient';
import { useAuth } from '../store/AuthContext';
import type { ApiDevice } from '../types/api';

export interface UseBoundDeviceResult {
    device: ApiDevice | null;
    bindStatus: 'idle' | 'pending' | 'bound' | 'conflict';
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/** Exposes the device currently bound to the user, plus the binding status. */
export function useBoundDevice(): UseBoundDeviceResult {
    const { bindStatus } = useAuth();
    const [device, setDevice] = useState<ApiDevice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await deviceApi.me();
            // Backend returns all the user's devices (active first); we surface the active one.
            setDevice(data.devices?.[0] ?? null);
        } catch (err) {
            const msg =
                (err as any)?.response?.data?.message ||
                (err as any)?.message ||
                'Failed to load device.';
            setError(String(msg));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { device, bindStatus, loading, error, refresh: load };
}
