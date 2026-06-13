/**
 * Time display helpers.
 *
 * Class schedule times are stored as 24-hour "HH:MM" strings (e.g. "20:00").
 * These format them for humans as 12-hour with a meridiem (e.g. "8:00 pm").
 */

/** "20:00" → "8:00 pm". Passes through already-formatted or unparseable input. */
export function formatTime12h(raw?: string | null): string {
    if (!raw) return '';
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!m) return raw.trim();

    let hour = parseInt(m[1], 10);
    const minutes = m[2];
    const meridiemIn = m[3]?.toLowerCase();

    if (meridiemIn) {
        // Already 12-hour with a meridiem — just normalise spacing/case.
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        return `${h12}:${minutes} ${meridiemIn}`;
    }

    const meridiem = hour >= 12 ? 'pm' : 'am';
    let h12 = hour % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${minutes} ${meridiem}`;
}

/** "20:00", "21:00" → "8:00 pm - 9:00 pm". Returns '' when neither is set. */
export function formatTimeRange(start?: string | null, end?: string | null): string {
    const s = formatTime12h(start);
    const e = formatTime12h(end);
    if (s && e) return `${s} - ${e}`;
    return s || e || '';
}
