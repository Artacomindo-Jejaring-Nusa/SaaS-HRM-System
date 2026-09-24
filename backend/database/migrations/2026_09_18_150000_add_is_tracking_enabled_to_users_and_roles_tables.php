<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'is_tracking_enabled')) {
                $table->boolean('is_tracking_enabled')->default(true)->after('attendance_type');
            }
        });

        Schema::table('roles', function (Blueprint $table) {
            if (!Schema::hasColumn('roles', 'is_tracking_enabled')) {
                $table->boolean('is_tracking_enabled')->default(true)->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'is_tracking_enabled')) {
                $table->dropColumn('is_tracking_enabled');
            }
        });

        Schema::table('roles', function (Blueprint $table) {
            if (Schema::hasColumn('roles', 'is_tracking_enabled')) {
                $table->dropColumn('is_tracking_enabled');
            }
        });
    }
};
