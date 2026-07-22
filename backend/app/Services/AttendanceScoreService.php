<?php

namespace App\Services;

use App\Models\AttendanceRecord;

/**
 * Turns the raw attendance signals into a single 0–100 integrity score and a
 * letter grade a lecturer can read at a glance.
 *
 * The score answers "how confident are we this student was genuinely present
 * for the whole class?" — not just "did they tap check-in?". It combines:
 *
 *   Turnout        40  present = 40, late = 25, absent = 0
 *   Location       20  inside the class geofence at check-in
 *   Stayed present 25  proportion of random presence pings answered
 *   Integrity      15  face verified (10) + no device switch mid-class (5)
 *                      ------------------------------------------------
 *                      100
 */
class AttendanceScoreService
{
    public const WEIGHT_TURNOUT = 40;
    public const WEIGHT_LOCATION = 20;
    public const WEIGHT_PRESENCE = 25;
    public const WEIGHT_INTEGRITY = 15;

    /**
     * @return array{
     *   score: int, grade: string, status: string, remark: string,
     *   turnout: int, location: int, presence: int, integrity: int
     * }
     */
    public function score(
        ?AttendanceRecord $record,
        int $totalPings = 0,
        int $answeredPings = 0,
        int $deviceChanges = 0,
    ): array {
        // No record at all — the student never checked in.
        if (!$record || !$record->checked_in_at) {
            return [
                'score' => 0,
                'grade' => 'F',
                'status' => 'Absent',
                'remark' => 'Did not check in',
                'turnout' => 0,
                'location' => 0,
                'presence' => 0,
                'integrity' => 0,
            ];
        }

        $isLate = $record->status === 'late';
        $turnout = $isLate ? 25 : self::WEIGHT_TURNOUT;

        $location = $record->within_geofence ? self::WEIGHT_LOCATION : 0;

        // Random presence pings. If none were issued, don't punish the student —
        // award full marks for the portion we couldn't measure.
        $presence = $totalPings > 0
            ? (int) round(self::WEIGHT_PRESENCE * ($answeredPings / $totalPings))
            : self::WEIGHT_PRESENCE;

        $integrity = ($record->face_verified ? 10 : 0) + ($deviceChanges > 0 ? 0 : 5);

        $score = max(0, min(100, $turnout + $location + $presence + $integrity));

        return [
            'score' => $score,
            'grade' => $this->grade($score),
            'status' => $isLate ? 'Late' : 'Present',
            'remark' => $this->remark($record, $totalPings, $answeredPings, $deviceChanges),
            'turnout' => $turnout,
            'location' => $location,
            'presence' => $presence,
            'integrity' => $integrity,
        ];
    }

    public function grade(int $score): string
    {
        return match (true) {
            $score >= 85 => 'A',
            $score >= 70 => 'B',
            $score >= 55 => 'C',
            $score >= 40 => 'D',
            default => 'F',
        };
    }

    /** Plain-English reason the student lost marks, for the CSV's Remark column. */
    private function remark(
        AttendanceRecord $record,
        int $totalPings,
        int $answeredPings,
        int $deviceChanges,
    ): string {
        $notes = [];

        if ($record->status === 'late') {
            $notes[] = 'Arrived late';
        }
        if (!$record->within_geofence) {
            $notes[] = 'Checked in outside class venue';
        }
        if ($totalPings > 0 && $answeredPings < $totalPings) {
            $notes[] = sprintf('Missed %d of %d presence checks', $totalPings - $answeredPings, $totalPings);
        }
        if (!$record->face_verified) {
            $notes[] = 'Face not verified';
        }
        if ($deviceChanges > 0) {
            $notes[] = sprintf('Changed device %d time(s)', $deviceChanges);
        }

        return $notes ? implode('; ', $notes) : 'Full attendance, no issues';
    }
}
