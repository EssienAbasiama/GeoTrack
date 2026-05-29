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
        Schema::create('presence_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('attendance_sessions')->cascadeOnDelete();
            $table->timestamp('triggered_at');
            $table->timestamp('expires_at');
            $table->string('trigger_type', 16)->default('random');
            $table->json('targeted_user_ids')->nullable();
            $table->timestamps();

            $table->index(['session_id', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('presence_checks');
    }
};
