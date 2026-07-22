<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceEvent;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\DeviceBindingEvent;
use App\Models\PresenceCheck;
use App\Models\PresenceResponse;
use App\Models\User;
use App\Services\AttendanceScoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lecturer-facing attendance exports.
 *
 *  - todayCsv:   one row per enrolled student for today's class (present/absent + score)
 *  - studentCsv: one row per class date for a single student, plus a summary
 */
class AttendanceReportController extends Controller
{
    public function __construct(private readonly AttendanceScoreService $scorer)
    {
    }

    /** Today's register for a course: every enrolled student, present or not. */
    public function todayCsv(Request $request, Course $course): StreamedResponse|JsonResponse
    {
        if ($denied = $this->denyUnlessLecturer($request, $course)) {
            return $denied;
        }

        $sessions = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->whereDate('starts_at', now()->toDateString())
            ->orderBy('starts_at')
            ->get();

        $rows = $this->buildRows($course, $sessions);

        $filename = $this->filename($course->code, now()->toDateString(), 'attendance');

        return $this->stream($filename, function ($out) use ($course, $sessions, $rows) {
            $this->writeReportHeader($out, [
                ['GeoTrack Attendance Report'],
                ['Course', sprintf('%s — %s', $course->code, $course->title)],
                ['Date', now()->format('l, d M Y')],
                ['Sessions held today', $sessions->count()],
                ['Students enrolled', count($rows)],
                ['Present', collect($rows)->where('status', '!=', 'Absent')->count()],
                ['Absent', collect($rows)->where('status', 'Absent')->count()],
            ]);

            $this->writeRegister($out, $rows);
            $this->writeScoreKey($out);
        });
    }

    /**
     * Register for a single session. Same shape as todayCsv — every enrolled
     * student appears, present or not, in alphabetical order.
     */
    public function sessionCsv(Request $request, AttendanceSession $session): StreamedResponse|JsonResponse
    {
        $course = $session->course;

        if ($denied = $this->denyUnlessLecturer($request, $course)) {
            return $denied;
        }

        $sessions = collect([$session]);
        $rows = $this->buildRows($course, $sessions);

        $date = optional($session->starts_at)->toDateString() ?? now()->toDateString();
        $filename = $this->filename($course->code, $date, 'attendance');

        return $this->stream($filename, function ($out) use ($course, $session, $rows) {
            $this->writeReportHeader($out, [
                ['GeoTrack Attendance Report'],
                ['Course', sprintf('%s — %s', $course->code, $course->title)],
                ['Date', optional($session->starts_at)->format('l, d M Y') ?? ''],
                ['Class time', optional($session->starts_at)->format('H:i') . ' - ' . optional($session->ends_at)->format('H:i')],
                ['Students enrolled', count($rows)],
                ['Present', collect($rows)->where('status', '!=', 'Absent')->count()],
                ['Absent', collect($rows)->where('status', 'Absent')->count()],
            ]);

            $this->writeRegister($out, $rows);
            $this->writeScoreKey($out);
        });
    }

    /** Full history for one student in one course. */
    public function studentCsv(Request $request, Course $course, int $userId): StreamedResponse|JsonResponse
    {
        if ($denied = $this->denyUnlessLecturer($request, $course)) {
            return $denied;
        }

        $student = User::query()->find($userId);
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $sessions = AttendanceSession::query()
            ->where('course_id', $course->id)
            ->orderBy('starts_at')
            ->get();

        $records = AttendanceRecord::query()
            ->where('user_id', $student->id)
            ->whereIn('session_id', $sessions->pluck('id'))
            ->get()
            ->keyBy('session_id');

        [$pingTotals, $pingAnswers] = $this->pingCounts($sessions, [$student->id]);

        $lines = [];
        $scoreSum = 0;
        $attended = 0;
        $minutesSum = 0;
        $reEntrySum = 0;

        foreach ($sessions as $session) {
            $record = $records->get($session->id);
            $deviceChanges = $this->deviceChanges($student->id, $session);

            $result = $this->scorer->score(
                $record,
                $pingTotals[$session->id] ?? 0,
                $pingAnswers[$session->id][$student->id] ?? 0,
                $deviceChanges,
            );

            $scoreSum += $result['score'];
            if ($result['status'] !== 'Absent') {
                $attended++;
            }
            $minutesSum += $record ? $record->minutesPresent($session->ends_at) : 0;
            $reEntrySum += $record ? (int) $record->re_entry_count : 0;

            $lines[] = [
                optional($session->starts_at)->format('Y-m-d'),
                optional($session->starts_at)->format('H:i') . ' - ' . optional($session->ends_at)->format('H:i'),
                $result['status'],
                $record?->checked_in_at?->format('H:i:s') ?? '',
                $record?->checked_out_at?->format('H:i:s')
                    ?? ($record?->last_entry_at ? 'Still in class' : ''),
                $record ? $this->duration($record->minutesPresent($session->ends_at)) : '',
                $record ? (int) $record->re_entry_count : 0,
                $record ? ($record->within_geofence ? 'Yes' : 'No') : '',
                sprintf('%d/%d', $pingAnswers[$session->id][$student->id] ?? 0, $pingTotals[$session->id] ?? 0),
                $record ? ($record->face_verified ? 'Yes' : 'No') : '',
                $deviceChanges,
                $result['score'],
                $result['grade'],
                $result['remark'],
            ];
        }

        $total = $sessions->count();
        $avg = $total > 0 ? (int) round($scoreSum / $total) : 0;
        $rate = $total > 0 ? round($attended / $total * 100, 1) : 0.0;

        $filename = $this->filename(
            $course->code . '_' . ($student->matric_no ?: $student->name),
            now()->toDateString(),
            'history',
        );

        return $this->stream($filename, function ($out) use ($course, $student, $sessions, $lines, $total, $attended, $rate, $avg, $minutesSum, $reEntrySum) {
            $this->writeReportHeader($out, [
                ['GeoTrack Student Attendance Report'],
                ['Student', $student->name],
                ['Matric No', $student->matric_no ?? ''],
                ['Email', $student->email],
                ['Course', sprintf('%s — %s', $course->code, $course->title)],
                ['Classes held', $total],
                ['Classes attended', $attended],
                ['Attendance rate', $rate . '%'],
                ['Total time in class', $this->duration($minutesSum)],
                ['Times left and returned', $reEntrySum],
                ['Average score', $avg . '%'],
                ['Overall grade', $this->scorer->grade($avg)],
            ]);

            fputcsv($out, [
                'S/N', 'Date', 'Class Time', 'Status', 'Check-In', 'Check-Out',
                'Time In Class', 'Re-Entries',
                'Within Venue', 'Presence Checks', 'Face Verified',
                'Device Changes', 'Score (%)', 'Grade', 'Remark',
            ]);

            $i = 1;
            foreach ($lines as $line) {
                fputcsv($out, array_merge([$i++], $line));
            }

            $this->writeActivityLog($out, $student, $sessions);
            $this->writeScoreKey($out);
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Build one row per enrolled student across the given sessions. */
    private function buildRows(Course $course, $sessions): array
    {
        $studentIds = CourseEnrollment::query()
            ->where('course_id', $course->id)
            ->pluck('user_id');

        // Alphabetical by name. Sorted in PHP because SQLite's ORDER BY is
        // case-sensitive, which would put "ada" after "Zainab".
        $students = User::query()
            ->whereIn('id', $studentIds)
            ->get(['id', 'name', 'email', 'matric_no'])
            ->sortBy(fn (User $u) => mb_strtolower((string) $u->name), SORT_NATURAL)
            ->values();

        $records = AttendanceRecord::query()
            ->whereIn('session_id', $sessions->pluck('id'))
            ->whereIn('user_id', $studentIds)
            ->get()
            ->groupBy('user_id');

        [$pingTotals, $pingAnswers] = $this->pingCounts($sessions, $studentIds->all());
        $totalPings = array_sum($pingTotals);

        $rows = [];
        foreach ($students as $student) {
            // Best record of the day (a student may appear in several sessions).
            $record = ($records[$student->id] ?? collect())
                ->sortByDesc(fn ($r) => $r->checked_in_at)
                ->first();

            $answered = 0;
            foreach ($sessions as $session) {
                $answered += $pingAnswers[$session->id][$student->id] ?? 0;
            }

            $deviceChanges = 0;
            foreach ($sessions as $session) {
                $deviceChanges += $this->deviceChanges($student->id, $session);
            }

            $result = $this->scorer->score($record, $totalPings, $answered, $deviceChanges);

            $sessionEnd = $sessions->firstWhere('id', $record?->session_id)?->ends_at;

            $rows[] = [
                'matric_no' => $student->matric_no ?? '',
                'name' => $student->name,
                'email' => $student->email,
                'status' => $result['status'],
                'checked_in_at' => $record?->checked_in_at?->format('H:i:s') ?? '',
                'checked_out_at' => $record?->checked_out_at?->format('H:i:s')
                    ?? ($record?->last_entry_at ? 'Still in class' : ''),
                'time_in_class' => $record ? $this->duration($record->minutesPresent($sessionEnd)) : '',
                're_entries' => $record ? (int) $record->re_entry_count : 0,
                'within_geofence' => $record ? ($record->within_geofence ? 'Yes' : 'No') : 'No',
                'pings' => sprintf('%d/%d', $answered, $totalPings),
                'face_verified' => $record ? ($record->face_verified ? 'Yes' : 'No') : 'No',
                'device_changes' => $deviceChanges,
                'score' => $result['score'],
                'grade' => $result['grade'],
                'remark' => $result['remark'],
            ];
        }

        return $rows;
    }

    /**
     * Presence-ping totals per session and answered-counts per session/user.
     *
     * @return array{0: array<int,int>, 1: array<int,array<int,int>>}
     */
    private function pingCounts($sessions, array $userIds): array
    {
        $sessionIds = $sessions->pluck('id');

        $checks = PresenceCheck::query()
            ->whereIn('session_id', $sessionIds)
            ->get(['id', 'session_id']);

        $totals = [];
        foreach ($sessionIds as $id) {
            $totals[$id] = 0;
        }
        foreach ($checks as $check) {
            $totals[$check->session_id] = ($totals[$check->session_id] ?? 0) + 1;
        }

        $checkToSession = $checks->pluck('session_id', 'id');

        $answers = [];
        if ($checks->isNotEmpty() && !empty($userIds)) {
            $responses = PresenceResponse::query()
                ->whereIn('presence_check_id', $checks->pluck('id'))
                ->whereIn('user_id', $userIds)
                ->where('status', 'verified')
                ->get(['presence_check_id', 'user_id']);

            foreach ($responses as $response) {
                $sessionId = $checkToSession[$response->presence_check_id] ?? null;
                if ($sessionId === null) {
                    continue;
                }
                $answers[$sessionId][$response->user_id] =
                    ($answers[$sessionId][$response->user_id] ?? 0) + 1;
            }
        }

        return [$totals, $answers];
    }

    /** How many times the student re-bound a device during this class. */
    private function deviceChanges(int $userId, AttendanceSession $session): int
    {
        if (!$session->starts_at) {
            return 0;
        }

        return DeviceBindingEvent::query()
            ->where('user_id', $userId)
            ->where('action', 'rebound')
            ->whereBetween('created_at', [$session->starts_at, $session->ends_at ?? now()])
            ->count();
    }

    private function denyUnlessLecturer(Request $request, Course $course): ?JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && $course->lecturer_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorised to export attendance for this course.',
            ], 403);
        }
        return null;
    }

    /** Leading summary block, then a blank line. */
    private function writeReportHeader($out, array $lines): void
    {
        foreach ($lines as $line) {
            fputcsv($out, $line);
        }
        fputcsv($out, []);
    }

    /** The register table: one row per enrolled student, already alphabetical. */
    private function writeRegister($out, array $rows): void
    {
        fputcsv($out, [
            'S/N', 'Matric No', 'Name', 'Email', 'Status', 'Check-In Time',
            'Check-Out Time', 'Time In Class', 'Re-Entries',
            'Within Venue', 'Presence Checks Answered', 'Face Verified',
            'Device Changes', 'Score (%)', 'Grade', 'Remark',
        ]);

        $i = 1;
        foreach ($rows as $r) {
            fputcsv($out, [
                $i++,
                $r['matric_no'],
                $r['name'],
                $r['email'],
                $r['status'],
                $r['checked_in_at'],
                $r['checked_out_at'],
                $r['time_in_class'],
                $r['re_entries'],
                $r['within_geofence'],
                $r['pings'],
                $r['face_verified'],
                $r['device_changes'],
                $r['score'],
                $r['grade'],
                $r['remark'],
            ]);
        }
    }

    /** Minutes as "1h 25m" / "40m" / "—". */
    private function duration(int $minutes): string
    {
        if ($minutes <= 0) {
            return '—';
        }
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return $h > 0 ? sprintf('%dh %02dm', $h, $m) : sprintf('%dm', $m);
    }

    /**
     * Every clock-in, clock-out and device change for this student, in order.
     * This is the trail behind the Re-Entries and Device Changes columns.
     */
    private function writeActivityLog($out, User $student, $sessions): void
    {
        $events = AttendanceEvent::query()
            ->where('user_id', $student->id)
            ->whereIn('session_id', $sessions->pluck('id'))
            ->orderBy('occurred_at')
            ->get()
            ->map(fn (AttendanceEvent $e) => [
                $e->occurred_at?->format('Y-m-d'),
                $e->occurred_at?->format('H:i:s'),
                $e->label(),
                $e->within_geofence ? 'Inside venue' : 'Outside venue',
            ]);

        $window = [$sessions->min('starts_at'), $sessions->max('ends_at') ?? now()];
        $deviceEvents = DeviceBindingEvent::query()
            ->where('user_id', $student->id)
            ->when($window[0], fn ($q) => $q->where('created_at', '>=', $window[0]))
            ->orderBy('created_at')
            ->get()
            ->map(fn (DeviceBindingEvent $e) => [
                $e->created_at?->format('Y-m-d'),
                $e->created_at?->format('H:i:s'),
                match ($e->action) {
                    'bound' => 'Device linked',
                    'rebound' => 'Moved to a new device',
                    'reset' => 'Device link reset',
                    default => $e->action,
                },
                $e->new_device_uid ? 'Device ' . substr($e->new_device_uid, 0, 8) : '',
            ]);

        $log = $events->concat($deviceEvents)->sortBy([0, 1])->values();
        if ($log->isEmpty()) {
            return;
        }

        fputcsv($out, []);
        fputcsv($out, ['Activity log']);
        fputcsv($out, ['Date', 'Time', 'Activity', 'Detail']);
        foreach ($log as $line) {
            fputcsv($out, $line);
        }
    }

    /** Trailing legend so the scoring is self-explanatory in the file. */
    private function writeScoreKey($out): void
    {
        fputcsv($out, []);
        fputcsv($out, ['How the score is calculated']);
        fputcsv($out, ['Turnout', '40 marks', 'Present = 40, Late = 25, Absent = 0']);
        fputcsv($out, ['Within venue', '20 marks', 'Inside the class geofence at check-in']);
        fputcsv($out, ['Stayed present', '25 marks', 'Share of random presence checks answered']);
        fputcsv($out, ['Integrity', '15 marks', 'Face verified (10) + no device switch during class (5)']);
        fputcsv($out, []);
        fputcsv($out, ['Grades', 'A = 85-100', 'B = 70-84', 'C = 55-69', 'D = 40-54', 'F = below 40']);
    }

    private function filename(string $prefix, string $date, string $kind): string
    {
        return preg_replace('/[^A-Za-z0-9_\-.]/', '_', "{$prefix}_{$date}_{$kind}.csv");
    }

    private function stream(string $filename, callable $writer): StreamedResponse
    {
        return response()->streamDownload(function () use ($writer) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel renders correctly
            $writer($out);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
