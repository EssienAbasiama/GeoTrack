<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use App\Models\PresenceCheck;
use App\Models\PresenceResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PresenceCheckService
{
    public function __construct(private readonly PushService $push)
    {
    }

    /**
     * For each active session whose presence checks are enabled, create a
     * new PresenceCheck if the previous one is older than the configured
     * interval. Sends push notifications to targeted students.
     */
    public function triggerForActiveSessions(): int
    {
        $created = 0;
        $now = now();

        $sessions = AttendanceSession::query()
            ->where('status', 'active')
            ->where('presence_checks_enabled', true)
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>', $now)
            ->get();

        foreach ($sessions as $session) {
            $latest = PresenceCheck::query()
                ->where('session_id', $session->id)
                ->latest('triggered_at')
                ->first();

            $interval = max(1, (int) $session->presence_check_interval_minutes);
            if ($latest && $latest->triggered_at && $latest->triggered_at->diffInMinutes($now) < $interval) {
                continue;
            }

            // Only target students who have actually checked in.
            $targetIds = AttendanceRecord::query()
                ->where('session_id', $session->id)
                ->whereIn('status', ['present', 'late'])
                ->pluck('user_id')
                ->all();

            if (empty($targetIds)) {
                continue;
            }

            DB::transaction(function () use ($session, $targetIds, $now) {
                $check = PresenceCheck::query()->create([
                    'session_id' => $session->id,
                    'triggered_at' => $now,
                    'expires_at' => Carbon::parse($now)->addMinutes(5),
                    'trigger_type' => 'random',
                    'targeted_user_ids' => $targetIds,
                ]);

                foreach ($targetIds as $userId) {
                    PresenceResponse::query()->updateOrCreate(
                        [
                            'presence_check_id' => $check->id,
                            'user_id' => $userId,
                        ],
                        ['status' => 'pending']
                    );
                }
            });

            $this->push->sendToUsers(
                $targetIds,
                'GeoTrack presence check',
                'Confirm you are still in class.',
                ['type' => 'presence_check', 'session_id' => $session->id]
            );

            $created++;
        }

        return $created;
    }

    /**
     * For each expired check, mark all pending responses as missed and
     * update the related attendance record's missed_checks counter.
     */
    public function markMissed(): int
    {
        $now = now();
        $marked = 0;

        $expiredChecks = PresenceCheck::query()
            ->where('expires_at', '<=', $now)
            ->whereHas('responses', function ($q) {
                $q->where('status', 'pending');
            })
            ->get();

        foreach ($expiredChecks as $check) {
            $pending = PresenceResponse::query()
                ->where('presence_check_id', $check->id)
                ->where('status', 'pending')
                ->get();

            foreach ($pending as $response) {
                DB::transaction(function () use ($response, $check) {
                    $response->update(['status' => 'missed']);

                    $record = AttendanceRecord::query()
                        ->where('session_id', $check->session_id)
                        ->where('user_id', $response->user_id)
                        ->first();

                    if ($record) {
                        $missed = (int) $record->missed_checks + 1;
                        $record->update([
                            'missed_checks' => $missed,
                            'present_throughout' => $missed === 0,
                        ]);
                    }
                });
                $marked++;
            }
        }

        return $marked;
    }
}
