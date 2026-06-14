<?php

use App\Console\Commands\CloseExpiredSessions;
use App\Console\Commands\NotifyUpcomingClasses;
use App\Http\Middleware\EnsureBoundDevice;
use App\Services\PresenceCheckService;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'bound.device' => EnsureBoundDevice::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->call(function (): void {
            app(PresenceCheckService::class)->triggerForActiveSessions();
        })->everyMinute()->name('presence-checks:trigger')->withoutOverlapping();

        $schedule->call(function (): void {
            app(PresenceCheckService::class)->markMissed();
        })->everyMinute()->name('presence-checks:mark-missed')->withoutOverlapping();

        $schedule->command(CloseExpiredSessions::class)
            ->everyMinute()
            ->name('sessions:close-expired')
            ->withoutOverlapping();

        $schedule->command(NotifyUpcomingClasses::class)
            ->everyMinute()
            ->name('classes:notify-upcoming')
            ->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
