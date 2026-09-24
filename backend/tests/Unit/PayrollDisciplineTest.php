<?php

namespace Tests\Unit;

use App\Models\Attendance;
use App\Models\PayrollSetting;
use App\Models\Schedule;
use App\Models\Shift;
use App\Services\PayrollService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use PHPUnit\Framework\TestCase;

class PayrollDisciplineTest extends TestCase
{
    protected PayrollService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PayrollService();
    }

    public function test_late_deduction_calculation_with_custom_tiers(): void
    {
        $setting = new PayrollSetting([
            'late_deduction_enabled' => true,
            'late_deduction_base' => 'daily_salary',
            'late_grace_period_minutes' => 5,
            'late_deduction_tiers' => [
                ['min_minutes' => 1, 'max_minutes' => 15, 'penalty_type' => 'percentage', 'penalty_value' => 1.0],
                ['min_minutes' => 16, 'max_minutes' => 30, 'penalty_type' => 'percentage', 'penalty_value' => 2.5],
                ['min_minutes' => 31, 'max_minutes' => 9999, 'penalty_type' => 'percentage', 'penalty_value' => 5.0],
            ],
        ]);

        $basicSalary = 6000000;
        $totalWorkingDays = 20; // daily salary = 300,000
        $totalFixedAllowance = 1000000;

        // Mock 3 attendances:
        // 1. On time (08:58)
        $att1 = new Attendance(['check_in' => '2026-09-01 08:58:00']);
        // 2. Late within grace period (09:04 - grace is 5 min) -> 0 penalty
        $att2 = new Attendance(['check_in' => '2026-09-02 09:04:00']);
        // 3. Late 20 minutes (09:20) -> tier 2 (16-30 min: 2.5%) -> 2.5% of 300,000 = 7,500
        $att3 = new Attendance(['check_in' => '2026-09-03 09:20:00']);

        $attendances = new Collection([$att1, $att2, $att3]);
        $schedulesMap = []; // default 09:00:00

        $result = $this->service->calculateLateDeduction(
            $attendances,
            $schedulesMap,
            $basicSalary,
            $totalWorkingDays,
            $totalFixedAllowance,
            $setting
        );

        $this->assertEquals(1, $result['late_count']);
        $this->assertEquals(20, $result['total_late_minutes']);
        $this->assertEquals(7500, $result['amount']);
    }

    public function test_absence_deduction_calculation(): void
    {
        $setting = new PayrollSetting([
            'absence_deduction_enabled' => true,
            'absence_deduction_base' => 'daily_salary',
            'absence_deduction_pct' => 100.0,
        ]);

        $basicSalary = 6600000;
        $totalWorkingDays = 22; // daily salary = 300,000
        $absentDays = 2; // 2 * 300,000 = 600,000

        $result = $this->service->calculateAbsenceDeduction(
            $absentDays,
            $totalWorkingDays,
            $basicSalary,
            $setting
        );

        $this->assertEquals(600000, $result['amount']);
        $this->assertEquals(2, $result['absent_days']);
        $this->assertEquals(100.0, $result['rate_pct']);
    }
}
