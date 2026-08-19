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
        Schema::table('fund_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('fund_requests', 'employee_name')) {
                $table->string('employee_name')->nullable()->after('user_id');
            }
            if (!Schema::hasColumn('fund_requests', 'title')) {
                $table->string('title')->nullable()->after('employee_name');
            }
            if (!Schema::hasColumn('fund_requests', 'divisi')) {
                $table->string('divisi')->nullable()->after('title');
            }
            if (!Schema::hasColumn('fund_requests', 'tujuan')) {
                $table->string('tujuan')->nullable()->after('divisi');
            }
            if (!Schema::hasColumn('fund_requests', 'priority')) {
                $table->string('priority')->default('Normal')->after('tujuan');
            }
            if (!Schema::hasColumn('fund_requests', 'signature')) {
                $table->longText('signature')->nullable()->after('priority');
            }
            if (!Schema::hasColumn('fund_requests', 'items')) {
                $table->json('items')->nullable()->after('signature');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('fund_requests', function (Blueprint $table) {
            $table->dropColumn(['employee_name', 'title', 'divisi', 'tujuan', 'priority', 'signature', 'items']);
        });
    }
};
