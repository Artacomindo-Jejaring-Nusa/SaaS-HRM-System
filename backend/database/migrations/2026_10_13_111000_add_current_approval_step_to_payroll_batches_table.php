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
        if (Schema::hasTable('payroll_batches')) {
            Schema::table('payroll_batches', function (Blueprint $table) {
                if (! Schema::hasColumn('payroll_batches', 'current_approval_step')) {
                    $table->unsignedInteger('current_approval_step')->nullable()->after('status');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('payroll_batches')) {
            Schema::table('payroll_batches', function (Blueprint $table) {
                if (Schema::hasColumn('payroll_batches', 'current_approval_step')) {
                    $table->dropColumn('current_approval_step');
                }
            });
        }
    }
};
