<?php

namespace App\Console\Commands;

use App\Models\AttendanceRecord;
use App\Models\AttendanceSession;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CloseExpiredSessions extends Command
{
    protected $signature = 'geotrack:close-expired-sessions';

    protected $description = 'Close attendance sessions whose end time has passed and auto-check-out any students still checked in.';

    public function handle(): int
    {
        $now = now();

        $sessions = AttendanceSession::query()
            ->whereIn('status', ['scheduled', 'active'])
            ->where('ends_at', '<=', $now)
            ->get();

        $checkedOut = 0;

        foreach ($sessions as $session) {
            DB::transaction(function () use ($session, $now, &$checkedOut) {
                // Any student who checked in but never checked out is checked out
                // automatically at the scheduled class end time.
                $checkedOut += AttendanceRecord::query()
                    ->where('session_id', $session->id)
                    ->whereNotNull('checked_in_at')
                    ->whereNull('checked_out_at')
                    ->update(['checked_out_at' => $session->ends_at]);

                $session->update([
                    'status' => 'closed',
                    'closed_at' => $now,
                ]);
            });
        }

        $this->info(sprintf(
            'Closed %d session(s); auto-checked-out %d student(s).',
            $sessions->count(),
            $checkedOut,
        ));
        return self::SUCCESS;
    }
}
