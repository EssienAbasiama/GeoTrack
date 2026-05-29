<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attendance_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opened_by')->constrained('users')->cascadeOnDelete();
            $table->string('mode', 32);
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->boolean('presence_checks_enabled')->default(true);
            $table->integer('presence_check_interval_minutes')->default(15);
            $table->integer('late_after_minutes')->default(10);
            $table->string('status', 16)->default('scheduled');
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['course_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_sessions');
    }
};
