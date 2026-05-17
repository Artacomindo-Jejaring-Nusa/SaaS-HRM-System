<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('leaves', function (Blueprint $table) {
            $table->foreignId('supervisor_approved_by')->nullable()->constrained('users')->onDelete('set null')->after('status');
            $table->timestamp('supervisor_approved_at')->nullable()->after('supervisor_approved_by');
            $table->text('supervisor_remark')->nullable()->after('supervisor_approved_at');
        });

        // Update existing pending statuses to pending_supervisor (or approved if no supervisor)
        // For simplicity, just update pending to pending_supervisor
        DB::table('leaves')->where('status', 'pending')->update(['status' => 'pending_supervisor']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leaves', function (Blueprint $table) {
            $table->dropForeign(['supervisor_approved_by']);
            $table->dropColumn(['supervisor_approved_by', 'supervisor_approved_at', 'supervisor_remark']);
        });

        DB::table('leaves')->where('status', 'pending_supervisor')->update(['status' => 'pending']);
    }
};
