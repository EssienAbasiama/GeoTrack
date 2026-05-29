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
        Schema::create('presence_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('presence_check_id')->constrained('presence_checks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('responded_at')->nullable();
            $table->decimal('response_lat', 10, 7)->nullable();
            $table->decimal('response_lng', 10, 7)->nullable();
            $table->boolean('within_geofence')->nullable();
            $table->boolean('face_verified')->default(false);
            $table->float('face_confidence')->nullable();
            $table->string('face_image_path')->nullable();
            $table->string('status', 16)->default('pending');
            $table->timestamps();

            $table->unique(['presence_check_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('presence_responses');
    }
};
