<?php

namespace App\Console\Commands;

use App\Mail\ClassStartingMail;
use App\Models\ClassReminder;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\User;
use App\Services\PushService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

class NotifyUpcomingClasses extends Command
{
    protected $signature = 'notify:upcoming-classes {--lead=15 : Minutes before start to notify}';

    protected $description = 'Notify enrolled students and the lecturer when a class is about to start.';

    public function handle(PushService $push): int
    {
        $lead = max(1, (int) $this->option('lead'));
        $now = now();
        $todayName = $now->format('l');
        $today = $now->toDateString();

        $courses = Course::query()
            ->whereRaw('LOWER(day) = ?', [strtolower($todayName)])
            ->whereNotNull('start_time')
            ->with('geofence')
            ->get();

        $notified = 0;

        foreach ($courses as $course) {
            [$h, $m] = $this->parseHourMinute($course->start_time);
            if ($h === null) {
                continue;
            }

            $start = $now->copy()->setTime($h, $m, 0);
            $minutesUntil = $now->diffInMinutes($start, false);

            // "About to start": between now and `lead` minutes from now.
            if ($minutesUntil < 0 || $minutesUntil > $lead) {
                continue;
            }

            // Once per course per day.
            $already = ClassReminder::query()
                ->where('course_id', $course->id)
                ->whereDate('reminded_on', $today)
                ->exists();
            if ($already) {
                continue;
            }

            $studentIds = CourseEnrollment::query()
                ->where('course_id', $course->id)
                ->pluck('user_id')
                ->all();
            $recipientIds = array_values(array_unique(array_filter(
                array_merge($studentIds, [$course->lecturer_id])
            )));
            if (empty($recipientIds)) {
                continue;
            }

            $recipients = User::query()->whereIn('id', $recipientIds)->get();

            $startLabel = $start->format('g:i A');
            $venue = $course->venue ?: ($course->geofence->name ?? '');
            $title = 'Class starting soon';
            $body = $minutesUntil > 0
                ? "{$course->code} starts in {$minutesUntil} min at {$startLabel}" . ($venue ? " · {$venue}" : '')
                : "{$course->code} is starting now" . ($venue ? " · {$venue}" : '');

            // Push — only users who left push notifications on.
            $pushUserIds = $recipients
                ->filter(fn (User $u) => (bool) $u->push_notifications_enabled)
                ->pluck('id')
                ->all();
            $push->sendToUsers($pushUserIds, $title, $body, [
                'type' => 'class_starting',
                'course_id' => $course->id,
                'code' => $course->code,
            ]);

            // Email — only users who left email notifications on.
            foreach ($recipients as $user) {
                if (!$user->email_notifications_enabled || empty($user->email)) {
                    continue;
                }
                try {
                    Mail::to($user->email)->send(new ClassStartingMail(
                        recipientName: $user->name,
                        courseCode: $course->code,
                        courseTitle: $course->title,
                        startTime: $startLabel,
                        venue: $venue,
                        minutesUntilStart: max(0, $minutesUntil),
                    ));
                } catch (Throwable $e) {
                    report($e);
                }
            }

            ClassReminder::query()->create([
                'course_id' => $course->id,
                'reminded_on' => $today,
            ]);
            $notified++;

            $this->info("Notified {$course->code} ({$recipients->count()} recipients).");
        }

        $this->info("Done. {$notified} class(es) notified.");
        return self::SUCCESS;
    }

    /** @return array{0: int|null, 1: int|null} */
    private function parseHourMinute(?string $time): array
    {
        if (!$time || !preg_match('/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i', trim($time), $mm)) {
            return [null, null];
        }
        $hour = (int) $mm[1];
        $minute = (int) $mm[2];
        $meridiem = isset($mm[3]) ? strtoupper($mm[3]) : null;
        if ($meridiem === 'PM' && $hour !== 12) {
            $hour += 12;
        }
        if ($meridiem === 'AM' && $hour === 12) {
            $hour = 0;
        }
        return [$hour, $minute];
    }
}
