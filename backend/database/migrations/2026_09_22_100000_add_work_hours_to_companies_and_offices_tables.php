<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->time('work_start_time')->default('08:30:00')->after('radius_meters');
            $table->time('work_end_time')->default('17:30:00')->after('work_start_time');
            $table->integer('late_tolerance_minutes')->default(0)->after('work_end_time');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->time('work_start_time')->nullable()->after('radius');
            $table->time('work_end_time')->nullable()->after('work_start_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['work_start_time', 'work_end_time', 'late_tolerance_minutes']);
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn(['work_start_time', 'work_end_time']);
        });
    }
};
