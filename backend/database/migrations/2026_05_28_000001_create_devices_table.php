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
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_uid', 128);
            $table->string('platform', 16);
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('os_name')->nullable();
            $table->string('os_version')->nullable();
            $table->string('app_version')->nullable();
            $table->string('push_token')->nullable();
            $table->timestamp('bound_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('revoked_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['user_id', 'device_uid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
