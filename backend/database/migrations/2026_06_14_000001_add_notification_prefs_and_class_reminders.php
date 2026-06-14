<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('push_notifications_enabled')->default(true)->after('password');
            $table->boolean('email_notifications_enabled')->default(true)->after('push_notifications_enabled');
        });

        // Dedupes "class is about to start" reminders to once per course per day.
        Schema::create('class_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->date('reminded_on');
            $table->timestamps();
            $table->unique(['course_id', 'reminded_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_reminders');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['push_notifications_enabled', 'email_notifications_enabled']);
        });
    }
};
