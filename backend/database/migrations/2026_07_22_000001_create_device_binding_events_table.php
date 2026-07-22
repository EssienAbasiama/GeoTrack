<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Audit trail of device bindings so a lecturer can see when a student moved
     * their account to a different phone — the main way proxy check-ins happen.
     */
    public function up(): void
    {
        Schema::create('device_binding_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 'bound' (first device), 'rebound' (switched phones), 'reset' (self-service unbind)
            $table->string('action', 16);
            $table->string('previous_device_uid', 128)->nullable();
            $table->string('new_device_uid', 128)->nullable();
            $table->string('device_label', 128)->nullable();
            $table->string('reason', 64)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_binding_events');
    }
};
