<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A student may leave a running class and clock back in. The attendance record
 * only ever holds the *current* state, so every entry and exit is logged here —
 * this is the audit trail the lecturer's report is built from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_record_id')->constrained()->cascadeOnDelete();
            $table->foreignId('session_id')->constrained('attendance_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained()->nullOnDelete();
            // check_in = first arrival, re_entry = came back after leaving, check_out = left
            $table->string('type');
            $table->timestamp('occurred_at');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('within_geofence')->default(false);
            $table->timestamps();

            $table->index(['session_id', 'user_id']);
            $table->index(['user_id', 'occurred_at']);
        });

        Schema::table('attendance_records', function (Blueprint $table) {
            // How many times they came back after clocking out.
            $table->unsignedInteger('re_entry_count')->default(0);
            // Minutes accumulated across completed stints (entry → exit).
            $table->unsignedInteger('minutes_present')->default(0);
            // Start of the stint currently in progress, null once checked out.
            $table->timestamp('last_entry_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            $table->dropColumn(['re_entry_count', 'minutes_present', 'last_entry_at']);
        });
        Schema::dropIfExists('attendance_events');
    }
};
