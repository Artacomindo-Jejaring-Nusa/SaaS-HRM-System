<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Optimize database indexes for rush-hour concurrent reads/writes.
     * Targets: attendance check-in/out peaks (08:00 & 17:00),
     * dashboard summary queries, and payroll batch processing.
     */
    public function up(): void
    {
        // ─── ATTENDANCES: Rush-hour check-in/out optimization ───
        Schema::table('attendances', function (Blueprint $table) {
            // Fast daily attendance lookup (check-in duplicate prevention)
            $table->index(['company_id', 'user_id', 'check_in'], 'idx_att_company_user_checkin');
            // Dashboard: today's attendance count by company
            $table->index(['company_id', 'check_in', 'status'], 'idx_att_company_checkin_status');
        });

        // ─── SALARIES: Payroll batch processing ───
        Schema::table('salaries', function (Blueprint $table) {
            $table->index(['company_id', 'batch_id', 'status'], 'idx_sal_company_batch_status');
            $table->index(['user_id', 'year', 'month'], 'idx_sal_user_period');
        });

        // ─── ACTIVITY LOGS: Audit trail queries ───
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->index(['company_id', 'created_at'], 'idx_alog_company_created');
            $table->index(['user_id', 'action'], 'idx_alog_user_action');
        });

        // ─── SCHEDULES: Shift lookup optimization ───
        Schema::table('schedules', function (Blueprint $table) {
            $table->index(['user_id', 'date'], 'idx_sched_user_date');
        });

        // ─── NOTIFICATIONS: Unread count queries ───
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'is_read', 'created_at'], 'idx_notif_user_read_created');
        });

        // ─── OVERTIMES: Monthly approval queries ───
        Schema::table('overtimes', function (Blueprint $table) {
            $table->index(['company_id', 'status', 'date'], 'idx_ot_company_status_date');
        });

        // ─── LEAVES: Active leave lookups ───
        Schema::table('leaves', function (Blueprint $table) {
            $table->index(['company_id', 'status', 'start_date', 'end_date'], 'idx_lv_company_status_dates');
        });

        // ─── PERMITS: Period-based filtering ───
        Schema::table('permits', function (Blueprint $table) {
            $table->index(['company_id', 'status', 'start_date'], 'idx_perm_company_status_start');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex('idx_att_company_user_checkin');
            $table->dropIndex('idx_att_company_checkin_status');
        });

        Schema::table('salaries', function (Blueprint $table) {
            $table->dropIndex('idx_sal_company_batch_status');
            $table->dropIndex('idx_sal_user_period');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex('idx_alog_company_created');
            $table->dropIndex('idx_alog_user_action');
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex('idx_sched_user_date');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notif_user_read_created');
        });

        Schema::table('overtimes', function (Blueprint $table) {
            $table->dropIndex('idx_ot_company_status_date');
        });

        Schema::table('leaves', function (Blueprint $table) {
            $table->dropIndex('idx_lv_company_status_dates');
        });

        Schema::table('permits', function (Blueprint $table) {
            $table->dropIndex('idx_perm_company_status_start');
        });
    }
};
