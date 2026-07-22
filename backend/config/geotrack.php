<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Demo / Simulation mode
    |--------------------------------------------------------------------------
    |
    | When enabled, the API honours a per-request `demo_bypass` flag sent by the
    | app's hidden "Simulation mode" toggle. Under that flag the server:
    |   - skips face verification at check-in / presence-check (marks verified), and
    |   - lets device binding re-bind a new phone instead of returning a conflict.
    |
    | This exists so a controlled classroom simulation still works when the crude
    | local face-hash matcher rejects genuine selfies, or when a student's account
    | is already bound to another device. It is OFF by default; enable it only for
    | demos by setting GEOTRACK_DEMO_MODE=true.
    |
    */
    'demo_mode' => (bool) env('GEOTRACK_DEMO_MODE', false),

    /*
    |--------------------------------------------------------------------------
    | Auto-open scheduled sessions
    |--------------------------------------------------------------------------
    |
    | When true, a session opens automatically whenever a course is inside its
    | timetabled day/time window — meaning students could mark attendance with
    | no lecturer involvement. Attendance must be explicitly enabled by the
    | lecturer, so this is OFF by default.
    |
    */
    'auto_open_scheduled_sessions' => (bool) env('GEOTRACK_AUTO_OPEN_SESSIONS', false),

];
