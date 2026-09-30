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
        // 1. Add Auto-Validation fields to users table
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'auto_validate_web_attendance')) {
                $table->boolean('auto_validate_web_attendance')->default(false)->after('is_wfh');
            }
            if (!Schema::hasColumn('users', 'auto_validate_until')) {
                $table->dateTime('auto_validate_until')->nullable()->after('auto_validate_web_attendance');
            }
            if (!Schema::hasColumn('users', 'auto_validate_updated_by')) {
                $table->foreignId('auto_validate_updated_by')->nullable()->constrained('users')->nullOnDelete()->after('auto_validate_until');
            }
            if (!Schema::hasColumn('users', 'auto_validate_updated_at')) {
                $table->timestamp('auto_validate_updated_at')->nullable()->after('auto_validate_updated_by');
            }
        });

        // 2. Add Web Attendance tracking and approval fields to attendances table
        Schema::table('attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('attendances', 'channel')) {
                $table->string('channel', 20)->default('mobile')->after('attendance_type'); // 'mobile' | 'web'
            }
            if (!Schema::hasColumn('attendances', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('channel');
            }
            if (!Schema::hasColumn('attendances', 'user_agent')) {
                $table->string('user_agent', 1000)->nullable()->after('ip_address');
            }
            if (!Schema::hasColumn('attendances', 'web_approval_status')) {
                $table->string('web_approval_status', 20)->nullable()->after('user_agent'); // 'valid' | 'pending' | 'rejected'
            }
            if (!Schema::hasColumn('attendances', 'web_approved_by')) {
                $table->foreignId('web_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('web_approval_status');
            }
            if (!Schema::hasColumn('attendances', 'web_approved_at')) {
                $table->timestamp('web_approved_at')->nullable()->after('web_approved_by');
            }
            if (!Schema::hasColumn('attendances', 'web_rejection_reason')) {
                $table->string('web_rejection_reason', 500)->nullable()->after('web_approved_at');
            }
        });

        // 3. Create Web Attendance Auto-Validation Audit Logs table
        if (!Schema::hasTable('web_attendance_audit_logs')) {
            Schema::create('web_attendance_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('action', 50); // 'enable', 'disable', 'bulk_enable', 'bulk_disable', 'update_expiry'
                $table->boolean('previous_auto_validate')->nullable();
                $table->boolean('new_auto_validate')->default(false);
                $table->dateTime('previous_expires_at')->nullable();
                $table->dateTime('new_expires_at')->nullable();
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->timestamps();

                $table->index(['user_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('web_attendance_audit_logs');

        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['web_approved_by']);
            $table->dropColumn([
                'channel',
                'ip_address',
                'user_agent',
                'web_approval_status',
                'web_approved_by',
                'web_approved_at',
                'web_rejection_reason'
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['auto_validate_updated_by']);
            $table->dropColumn([
                'auto_validate_web_attendance',
                'auto_validate_until',
                'auto_validate_updated_by',
                'auto_validate_updated_at'
            ]);
        });
    }
};
