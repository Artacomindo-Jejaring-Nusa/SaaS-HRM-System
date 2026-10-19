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
        Schema::table('attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('attendances', 'is_early_out')) {
                $table->boolean('is_early_out')->default(false)->after('web_rejection_reason');
            }
            if (! Schema::hasColumn('attendances', 'early_out_reason')) {
                $table->text('early_out_reason')->nullable()->after('is_early_out');
            }
            if (! Schema::hasColumn('attendances', 'early_out_status')) {
                $table->string('early_out_status', 20)->nullable()->after('early_out_reason'); // 'pending' | 'approved' | 'rejected'
            }
            if (! Schema::hasColumn('attendances', 'early_out_approved_by')) {
                $table->foreignId('early_out_approved_by')->nullable()->constrained('users')->nullOnDelete()->after('early_out_status');
            }
            if (! Schema::hasColumn('attendances', 'early_out_approved_at')) {
                $table->timestamp('early_out_approved_at')->nullable()->after('early_out_approved_by');
            }
            if (! Schema::hasColumn('attendances', 'early_out_rejection_reason')) {
                $table->string('early_out_rejection_reason', 500)->nullable()->after('early_out_approved_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['early_out_approved_by']);
            $table->dropColumn([
                'is_early_out',
                'early_out_reason',
                'early_out_status',
                'early_out_approved_by',
                'early_out_approved_at',
                'early_out_rejection_reason',
            ]);
        });
    }
};
