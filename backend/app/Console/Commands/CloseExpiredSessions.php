<?php

namespace App\Console\Commands;

use App\Models\AttendanceSession;
use Illuminate\Console\Command;

class CloseExpiredSessions extends Command
{
    protected $signature = 'geotrack:close-expired-sessions';

    protected $description = 'Close attendance sessions whose end time has passed.';

    public function handle(): int
    {
        $now = now();

        $sessions = AttendanceSession::query()
            ->whereIn('status', ['scheduled', 'active'])
            ->where('ends_at', '<=', $now)
            ->get();

        foreach ($sessions as $session) {
            $session->update([
                'status' => 'closed',
                'closed_at' => $now,
            ]);
        }

        $this->info(sprintf('Closed %d session(s).', $sessions->count()));
        return self::SUCCESS;
    }
}
