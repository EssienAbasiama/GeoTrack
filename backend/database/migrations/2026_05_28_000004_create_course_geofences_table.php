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
        Schema::create('course_geofences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('shape', 16);
            $table->decimal('center_lat', 10, 7)->nullable();
            $table->decimal('center_lng', 10, 7)->nullable();
            $table->integer('radius_m')->nullable()->default(50);
            $table->json('polygon_json')->nullable();
            $table->string('label');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('course_geofences');
    }
};
