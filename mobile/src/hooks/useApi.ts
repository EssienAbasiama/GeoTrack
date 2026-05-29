import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface UseApiResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Generic data-fetching hook with mounted-guard, refresh, and error capture.
 *
 * @example
 * const { data, loading, error, refresh } = useApi(() => courseApi.list(), []);
 */
export function useApi<T>(
    fetcher: () => Promise<{ data: T }>,
    deps: ReadonlyArray<unknown> = [],
): UseApiResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetcher();
            if (!mountedRef.current) return;
            setData(res.data);
        } catch (err) {
            if (!mountedRef.current) return;
            const msg =
                (err as any)?.response?.data?.message ||
                (err as any)?.message ||
                'Failed to load.';
            setError(String(msg));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps as unknown as React.DependencyList);

    useEffect(() => {
        mountedRef.current = true;
        load();
        return () => {
            mountedRef.current = false;
        };
    }, [load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    return { data, loading, error, refresh };
}
