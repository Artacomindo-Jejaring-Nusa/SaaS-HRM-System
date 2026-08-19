<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Tipe absensi: kantor biasa atau dinas luar
            $table->string('attendance_type', 20)->default('office')->after('status');

            // Detail dinas luar
            $table->string('dinas_luar_destination')->nullable()->after('attendance_type');
            $table->text('dinas_luar_notes')->nullable()->after('dinas_luar_destination');

            // Approval flow dinas luar
            $table->string('dinas_luar_status', 20)->nullable()->after('dinas_luar_notes');
            $table->unsignedBigInteger('approved_by_spv')->nullable()->after('dinas_luar_status');
            $table->timestamp('approved_at_spv')->nullable()->after('approved_by_spv');
            $table->unsignedBigInteger('approved_by_hr')->nullable()->after('approved_at_spv');
            $table->timestamp('approved_at_hr')->nullable()->after('approved_by_hr');
            $table->text('rejection_reason')->nullable()->after('approved_at_hr');

            // Foreign keys
            $table->foreign('approved_by_spv')->references('id')->on('users')->nullOnDelete();
            $table->foreign('approved_by_hr')->references('id')->on('users')->nullOnDelete();

            // Index for queries
            $table->index('attendance_type');
            $table->index('dinas_luar_status');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['approved_by_spv']);
            $table->dropForeign(['approved_by_hr']);
            $table->dropColumn([
                'attendance_type', 'dinas_luar_destination', 'dinas_luar_notes',
                'dinas_luar_status', 'approved_by_spv', 'approved_at_spv',
                'approved_by_hr', 'approved_at_hr', 'rejection_reason',
            ]);
        });
    }
};
