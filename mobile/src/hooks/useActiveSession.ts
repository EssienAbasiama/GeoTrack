import { sessionApi } from '../services/apiClient';
import type { ApiSession } from '../types/api';
import { useApi } from './useApi';

/**
 * Polls the active session for a course. Returns `null` data when no session
 * is currently active for that course.
 */
export function useActiveSession(courseId: number | string | null | undefined) {
    return useApi<{ session: ApiSession | null }>(
        async () => {
            if (!courseId) return { data: { session: null } };
            return sessionApi.active(courseId);
        },
        [courseId],
    );
}
