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
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('attendance_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->string('status', 16);
            $table->timestamp('checked_in_at')->nullable();
            $table->decimal('check_in_lat', 10, 7)->nullable();
            $table->decimal('check_in_lng', 10, 7)->nullable();
            $table->float('check_in_accuracy_m')->nullable();
            $table->float('distance_from_center_m')->nullable();
            $table->boolean('within_geofence')->default(false);
            $table->boolean('face_verified')->default(false);
            $table->float('face_confidence')->nullable();
            $table->string('face_image_path')->nullable();
            $table->boolean('present_throughout')->default(false);
            $table->integer('missed_checks')->default(0);
            $table->timestamps();

            $table->unique(['session_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
