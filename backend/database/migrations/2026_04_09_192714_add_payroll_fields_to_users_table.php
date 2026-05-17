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
        Schema::table('users', function (Blueprint $table) {
            $table->string('ptkp_status')->nullable()->default('TK/0');
            $table->string('bpjs_kesehatan_no')->nullable();
            $table->string('bpjs_ketenagakerjaan_no')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('bank_account_no')->nullable();
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->decimal('fixed_allowance', 15, 2)->default(0);
            $table->integer('working_days_per_week')->default(5);
            $table->string('payroll_type')->default('monthly'); // monthly, daily, hourly
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'ptkp_status', 'bpjs_kesehatan_no', 'bpjs_ketenagakerjaan_no',
                'bank_name', 'bank_account_no', 'basic_salary',
                'fixed_allowance', 'working_days_per_week', 'payroll_type',
            ]);
        });
    }
};
