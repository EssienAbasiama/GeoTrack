<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->string('venue')->nullable()->after('level');
            $table->string('day', 16)->nullable()->after('venue');
            $table->string('start_time', 8)->nullable()->after('day');
            $table->string('end_time', 8)->nullable()->after('start_time');
            $table->string('department')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['venue', 'day', 'start_time', 'end_time']);
            $table->string('department')->nullable(false)->change();
        });
    }
};
