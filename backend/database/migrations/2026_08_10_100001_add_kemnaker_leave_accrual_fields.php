<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah kolom akrual cuti di tabel users
        Schema::table('users', function (Blueprint $table) {
            $table->date('leave_period_start')->nullable()->after('leave_balance');
            $table->integer('leave_accrued')->default(0)->after('leave_period_start');
            $table->integer('leave_used')->default(0)->after('leave_accrued');
            $table->integer('leave_expand_used')->default(0)->after('leave_used');
            $table->date('leave_expand_last_month')->nullable()->after('leave_expand_used');
        });

        // Tambah metadata Kemnaker di tabel leaves
        Schema::table('leaves', function (Blueprint $table) {
            $table->integer('duration_days')->nullable()->after('end_date');
            $table->boolean('is_paid')->default(true)->after('duration_days');
            $table->string('kemnaker_article')->nullable()->after('is_paid');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'leave_period_start', 'leave_accrued', 'leave_used',
                'leave_expand_used', 'leave_expand_last_month',
            ]);
        });

        Schema::table('leaves', function (Blueprint $table) {
            $table->dropColumn(['duration_days', 'is_paid', 'kemnaker_article']);
        });
    }
};
