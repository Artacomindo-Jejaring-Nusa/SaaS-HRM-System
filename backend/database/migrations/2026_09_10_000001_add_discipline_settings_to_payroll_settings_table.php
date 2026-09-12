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
        Schema::table('payroll_settings', function (Blueprint $table) {
            // Late deduction configuration
            $table->boolean('late_deduction_enabled')->default(true)->after('overtime_rate_holiday_per_hour');
            $table->string('late_deduction_base')->default('daily_salary')->after('late_deduction_enabled'); // daily_salary, basic_salary, attendance_allowance, fixed_amount
            $table->integer('late_grace_period_minutes')->default(0)->after('late_deduction_base');
            $table->json('late_deduction_tiers')->nullable()->after('late_grace_period_minutes');

            // Absence / Alfa deduction configuration
            $table->boolean('absence_deduction_enabled')->default(true)->after('late_deduction_tiers');
            $table->string('absence_deduction_base')->default('daily_salary')->after('absence_deduction_enabled'); // daily_salary, basic_salary, fixed_amount
            $table->decimal('absence_deduction_pct', 5, 2)->default(100.00)->after('absence_deduction_base'); // % per day of absence
            $table->boolean('absence_forfeit_allowance')->default(true)->after('absence_deduction_pct');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payroll_settings', function (Blueprint $table) {
            $table->dropColumn([
                'late_deduction_enabled',
                'late_deduction_base',
                'late_grace_period_minutes',
                'late_deduction_tiers',
                'absence_deduction_enabled',
                'absence_deduction_base',
                'absence_deduction_pct',
                'absence_forfeit_allowance',
            ]);
        });
    }
};
