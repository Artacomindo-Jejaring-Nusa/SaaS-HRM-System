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
        Schema::table('overtimes', function (Blueprint $table) {
            $table->foreignId('assigned_by')->nullable()->after('company_id')->constrained('users')->onDelete('set null');
            $table->foreignId('division_id')->nullable()->after('assigned_by')->constrained('roles')->onDelete('set null');
            $table->text('rejection_reason')->nullable()->after('remark');
            $table->timestamp('responded_at')->nullable()->after('rejection_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('overtimes', function (Blueprint $table) {
            $table->dropForeign(['assigned_by']);
            $table->dropForeign(['division_id']);
            $table->dropColumn(['assigned_by', 'division_id', 'rejection_reason', 'responded_at']);
        });
    }
};
