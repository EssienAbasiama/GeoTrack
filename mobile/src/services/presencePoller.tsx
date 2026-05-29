import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { presenceApi, navigationRef } from './apiClient';
import { registerPushTokenWithBackend } from './notifications';

const POLL_MS = 30_000;

/**
 * Background component that:
 *  - Polls /presence/pending every 30s while the app is foregrounded and
 *    the user is signed in + device-bound.
 *  - Registers the Expo push token with the backend after the device is bound.
 *
 * Mount once inside the auth provider. Renders nothing.
 */
export function PresencePoller() {
    const { isAuthenticated, bindStatus } = useAuth();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSeenIdsRef = useRef<Set<string>>(new Set());
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    // Register push token after device is bound
    useEffect(() => {
        if (bindStatus === 'bound') {
            registerPushTokenWithBackend().catch(() => { /* ignore */ });
        }
    }, [bindStatus]);

    // Poll for presence checks
    useEffect(() => {
        const shouldPoll = isAuthenticated && bindStatus === 'bound';

        const stop = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const tick = async () => {
            if (appStateRef.current !== 'active') return;
            try {
                const { data } = await presenceApi.pending();
                const checks = data?.responses ?? [];
                for (const check of checks) {
                    const key = String(check.id);
                    if (lastSeenIdsRef.current.has(key)) continue;
                    if (check.status !== 'pending') continue;
                    lastSeenIdsRef.current.add(key);

                    if (navigationRef.isReady()) {
                        navigationRef.navigate('PresenceCheck', {
                            checkId: check.id,
                            courseCode: check.course_code ?? '',
                            courseName: check.course_name ?? '',
                            expiresAt: check.expires_at,
                        });
                        break; // Only push one at a time
                    }
                }
            } catch {
                // swallow network errors – next tick will retry
            }
        };

        if (shouldPoll) {
            // initial check, then interval
            tick();
            intervalRef.current = setInterval(tick, POLL_MS);
        } else {
            stop();
        }

        const sub = AppState.addEventListener('change', (state) => {
            appStateRef.current = state;
            if (state === 'active' && shouldPoll) {
                tick();
            }
        });

        return () => {
            stop();
            sub.remove();
        };
    }, [isAuthenticated, bindStatus]);

    return null;
}
