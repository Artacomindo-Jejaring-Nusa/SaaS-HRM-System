<?php

namespace App\Services;

use App\Models\EmployeeComponent;
use App\Models\PayrollComponent;
use App\Models\PayslipDetail;
use App\Models\Salary;
use App\Models\User;
use Carbon\Carbon;

class DynamicPayrollEngine
{
    /**
     * Get all components assigned and active for a user in a given period.
     */
    public function getApplicableComponentsForUser(User $user, Carbon $startDate, Carbon $endDate, int $month, int $year): array
    {
        $allComponents = PayrollComponent::where('company_id', $user->company_id)
            ->active()
            ->with(['triggers', 'assignments'])
            ->get();

        $applicable = [];

        foreach ($allComponents as $comp) {
            // Check assignment: Global, Role, or User specific
            $assignment = $this->resolveAssignment($comp, $user);
            if (! $assignment) {
                continue;
            }

            // Check triggers
            if ($this->evaluateTriggers($comp, $user, $startDate, $endDate, $year)) {
                $applicable[] = [
                    'component' => $comp,
                    'assignment' => $assignment,
                ];
            }
        }

        return $applicable;
    }

    /**
     * Resolve assignment hierarchy: Individual > Role > Global
     */
    private function resolveAssignment(PayrollComponent $comp, User $user): ?EmployeeComponent
    {
        $userAssign = $comp->assignments->first(fn ($a) => $a->user_id === $user->id && $a->is_active);
        $roleAssign = $user->role_id ? $comp->assignments->first(fn ($a) => $a->role_id === $user->role_id && $a->is_active) : null;
        $globalAssign = $comp->assignments->first(fn ($a) => $a->is_global && $a->is_active);

        return $userAssign ?? $roleAssign ?? $globalAssign;
    }

    /**
     * Evaluate triggers for the component in the current payroll period.
     */
    public function evaluateTriggers(PayrollComponent $comp, User $user, Carbon $startDate, Carbon $endDate, int $year): bool
    {
        // If no triggers configured, default to recurring monthly
        if ($comp->triggers->isEmpty()) {
            return true;
        }

        foreach ($comp->triggers as $trigger) {
            if ($this->evaluateSingleTrigger($trigger->trigger_type, $trigger->config ?? [], $user, $startDate, $endDate, $year)) {
                return true;
            }
        }

        return false;
    }

    private function evaluateSingleTrigger(string $type, array $config, User $user, Carbon $startDate, Carbon $endDate, int $year): bool
    {
        return match ($type) {
            'recurring_monthly' => true,

            'fixed_calendar_date' => $this->evaluateFixedDateTrigger($config, $startDate, $endDate, $year),

            'date_range' => $this->evaluateDateRangeTrigger($config, $startDate, $endDate),

            'employee_anniversary' => $this->evaluateAnniversaryTrigger($config, $user, $startDate, $endDate),

            'manual' => false, // Only added manually via Ad-Hoc

            default => false,
        };
    }

    private function evaluateFixedDateTrigger(array $config, Carbon $startDate, Carbon $endDate, int $year): bool
    {
        // Example config: {"date": "08-17"} or {"month": 8, "day": 17}
        $dateStr = $config['date'] ?? null;
        if (! $dateStr && isset($config['month'], $config['day'])) {
            $dateStr = sprintf('%02d-%02d', (int) $config['month'], (int) $config['day']);
        }

        if (! $dateStr) {
            return false;
        }

        try {
            $targetDate = Carbon::parse("{$year}-{$dateStr}")->startOfDay();

            return $targetDate->between($startDate->copy()->startOfDay(), $endDate->copy()->endOfDay());
        } catch (\Throwable) {
            return false;
        }
    }

    private function evaluateDateRangeTrigger(array $config, Carbon $startDate, Carbon $endDate): bool
    {
        // Example config: {"start_date": "2026-03-20", "end_date": "2026-03-31"}
        if (empty($config['start_date']) || empty($config['end_date'])) {
            return false;
        }

        try {
            $rangeStart = Carbon::parse($config['start_date'])->startOfDay();
            $rangeEnd = Carbon::parse($config['end_date'])->endOfDay();

            // Check if ranges overlap
            return $rangeStart->lte($endDate) && $rangeEnd->gte($startDate);
        } catch (\Throwable) {
            return false;
        }
    }

    private function evaluateAnniversaryTrigger(array $config, User $user, Carbon $startDate, Carbon $endDate): bool
    {
        if (! $user->join_date) {
            return false;
        }

        try {
            $joinDate = Carbon::parse($user->join_date)->startOfDay();
            $reqYears = (int) ($config['years_of_service'] ?? 0);

            // Anniversary this year
            $anniversaryThisYear = $joinDate->copy()->year($startDate->year);
            if ($anniversaryThisYear->between($startDate, $endDate)) {
                $yearsCompleted = $joinDate->diffInYears($anniversaryThisYear);
                return $reqYears === 0 || $yearsCompleted >= $reqYears;
            }
        } catch (\Throwable) {
            // fall through
        }

        return false;
    }

    /**
     * Calculate nominal amount for a component based on calculation rule.
     */
    public function calculateComponentAmount(PayrollComponent $comp, ?EmployeeComponent $assignment, array $context): array
    {
        $customAmount = $assignment?->custom_amount;
        $rule = $comp->calculation_rule ?? 'fixed';

        $basicSalary = (float) ($context['basic_salary'] ?? 0);
        $attendedDays = (int) ($context['attended_days'] ?? 0);

        $amount = 0;
        $note = '';

        switch ($rule) {
            case 'fixed':
                $amount = (float) ($customAmount ?? $comp->default_amount ?? 0);
                $note = 'Nominal tetap bulanan';
                break;

            case 'attendance':
                $rate = (float) ($customAmount ?? $comp->default_amount ?? 0);
                $amount = $rate * $attendedDays;
                $note = "{$attendedDays} hari hadir × Rp ".number_format($rate, 0, ',', '.');
                break;

            case 'percentage':
                $pct = (float) ($comp->percentage_value ?? 0);
                $basisType = $comp->percentage_basis ?? 'basic_salary';
                $base = match ($basisType) {
                    'gross_salary' => (float) ($context['gross_salary'] ?? $basicSalary),
                    default => $basicSalary,
                };
                $amount = round($base * ($pct / 100));
                $note = "{$pct}% dari ".str_replace('_', ' ', $basisType);
                break;

            case 'formula':
                $result = $this->evaluateFormula($comp->formula_expression ?? '', $context);
                $amount = $result['amount'];
                $note = $result['note'];
                break;

            case 'adhoc':
                $amount = (float) ($customAmount ?? $comp->default_amount ?? 0);
                $note = 'Variabel Ad-Hoc';
                break;

            default:
                $amount = (float) ($customAmount ?? $comp->default_amount ?? 0);
                break;
        }

        return [
            'amount' => max(0, $amount),
            'note' => $note,
            'rule' => $rule,
        ];
    }

    /**
     * Safely evaluate arithmetic formula expression.
     */
    public function evaluateFormula(string $expression, array $context): array
    {
        if (trim($expression) === '') {
            return ['amount' => 0, 'note' => 'Formula kosong'];
        }

        $basicSalary = (float) ($context['basic_salary'] ?? 0);
        $attendanceDays = (int) ($context['attended_days'] ?? 0);
        $totalWorkingDays = (int) ($context['total_working_days'] ?? 20);
        $absentDays = (int) ($context['absent_days'] ?? 0);
        $overtimeHours = (float) ($context['overtime_hours'] ?? 0);
        $lateMinutes = (int) ($context['late_minutes'] ?? 0);
        $tenureYears = (float) ($context['tenure_years'] ?? 0);

        $vars = [
            'basic_salary' => $basicSalary,
            'attendance_days' => $attendanceDays,
            'working_days' => $attendanceDays,
            'total_working_days' => $totalWorkingDays,
            'absent_days' => $absentDays,
            'overtime_hours' => $overtimeHours,
            'late_minutes' => $lateMinutes,
            'tenure_years' => $tenureYears,
        ];

        // Replace variable tokens with numeric values
        $computedExpr = $expression;
        foreach ($vars as $key => $val) {
            $computedExpr = preg_replace('/\b'.preg_quote($key, '/').'\b/i', (string) $val, $computedExpr);
        }

        // Sanitization: Allow ONLY safe math characters (numbers, +, -, *, /, ., (, ), spaces)
        if (! preg_match('/^[\d+\-*\/().,\s]+$/', $computedExpr)) {
            return ['amount' => 0, 'note' => 'Formula mengandung karakter tidak valid'];
        }

        try {
            // Safe evaluation using isolated arithmetic parser
            $computedExpr = str_replace(',', '', $computedExpr);
            $amount = $this->evaluateArithmeticExpression($computedExpr);
            $resultAmount = max(0, round((float) $amount, 2));
            $note = "Rumus: {$expression}";
        } catch (\Throwable $e) {
            $resultAmount = 0;
            $note = 'Gagal evaluasi rumus: '.$e->getMessage();
        }

        return [
            'amount' => $resultAmount,
            'note' => $note,
        ];
    }

    /**
     * Safely evaluate arithmetic expression without using eval.
     */
    private function evaluateArithmeticExpression(string $expr): float
    {
        return ExpressionEvaluator::evaluate($expr);
    }

    private function buildStatutoryEarningsSnapshot(Salary $salary, array $context): array
    {
        $details = [];

        // Gaji Pokok
        $details[] = [
            'salary_id' => $salary->id,
            'component_id' => null,
            'component_name' => 'Gaji Pokok',
            'type' => 'earning',
            'calculation_rule' => 'fixed',
            'amount' => (float) $salary->basic_salary,
            'note' => 'Gaji Pokok Karyawan',
            'is_adhoc' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        // Tunjangan Kehadiran (if any)
        if ((float) $salary->earning_attendance_allowance > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'Tunjangan Kehadiran',
                'type' => 'earning',
                'calculation_rule' => 'attendance',
                'amount' => (float) $salary->earning_attendance_allowance,
                'note' => "{$salary->working_days} hari hadir",
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Lembur (if any)
        if ((float) $salary->earning_overtime > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'Uang Lembur (Overtime)',
                'type' => 'earning',
                'calculation_rule' => 'formula',
                'amount' => (float) $salary->earning_overtime,
                'note' => ($context['overtime_hours'] ?? 0).' jam lembur approved',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Premi BPJS Kesehatan Ditanggung Perusahaan (if any)
        if ((float) $salary->earning_bpjs_kes_premium > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'Premi BPJS Kesehatan (Perusahaan)',
                'type' => 'earning',
                'calculation_rule' => 'percentage',
                'amount' => (float) $salary->earning_bpjs_kes_premium,
                'note' => 'Iuran BPJS-Kes 4% dari perusahaan',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        return $details;
    }

    private function buildDynamicComponentsSnapshot(Salary $salary, User $user, array $context, Carbon $startDate, Carbon $endDate, int $month, int $year): array
    {
        $applicable = $this->getApplicableComponentsForUser($user, $startDate, $endDate, $month, $year);
        $totalDynamicEarnings = 0;
        $totalDynamicDeductions = 0;
        $details = [];

        foreach ($applicable as $item) {
            $comp = $item['component'];
            $assign = $item['assignment'];

            $calc = $this->calculateComponentAmount($comp, $assign, $context);
            $calcAmount = (float) $calc['amount'];

            if ($calcAmount > 0) {
                $details[] = [
                    'salary_id' => $salary->id,
                    'component_id' => $comp->id,
                    'component_name' => $comp->name,
                    'type' => $comp->type,
                    'calculation_rule' => $calc['rule'],
                    'amount' => $calcAmount,
                    'note' => $calc['note'],
                    'is_adhoc' => $calc['rule'] === 'adhoc',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if ($comp->type === 'earning') {
                    $totalDynamicEarnings += $calcAmount;
                } else {
                    $totalDynamicDeductions += $calcAmount;
                }
            }
        }

        return [
            'details' => $details,
            'total_earnings' => $totalDynamicEarnings,
            'total_deductions' => $totalDynamicDeductions,
        ];
    }

    private function buildStatutoryDeductionsSnapshot(Salary $salary, array $context): array
    {
        $details = [];

        if ((float) $salary->deduction_bpjs_jht > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'BPJS Ketenagakerjaan (JHT)',
                'type' => 'deduction',
                'calculation_rule' => 'percentage',
                'amount' => (float) $salary->deduction_bpjs_jht,
                'note' => 'Iuran JHT Karyawan 2%',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ((float) $salary->deduction_bpjs_jp > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'BPJS Ketenagakerjaan (JP)',
                'type' => 'deduction',
                'calculation_rule' => 'percentage',
                'amount' => (float) $salary->deduction_bpjs_jp,
                'note' => 'Iuran JP Karyawan 1%',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ((float) $salary->deduction_bpjs_kes > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'BPJS Kesehatan (Karyawan)',
                'type' => 'deduction',
                'calculation_rule' => 'percentage',
                'amount' => (float) $salary->deduction_bpjs_kes,
                'note' => 'Iuran BPJS-Kes Karyawan 1%',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ((float) $salary->deduction_absence > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'Potongan Absensi / Alfa',
                'type' => 'deduction',
                'calculation_rule' => 'formula',
                'amount' => (float) $salary->deduction_absence,
                'note' => ($context['absent_days'] ?? 0).' hari mangkir',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ((float) $salary->deduction_late > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'Potongan Keterlambatan',
                'type' => 'deduction',
                'calculation_rule' => 'formula',
                'amount' => (float) $salary->deduction_late,
                'note' => ($context['late_minutes'] ?? 0).' menit akumulasi keterlambatan',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ((float) $salary->deduction_tax > 0) {
            $details[] = [
                'salary_id' => $salary->id,
                'component_id' => null,
                'component_name' => 'PPh 21',
                'type' => 'deduction',
                'calculation_rule' => 'percentage',
                'amount' => (float) $salary->deduction_tax,
                'note' => 'Pajak Penghasilan Pasal 21',
                'is_adhoc' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        return $details;
    }

    /**
     * Generate complete immutable snapshot rows into payslip_details.
     */
    public function generateSnapshotDetails(Salary $salary, User $user, array $context, Carbon $startDate, Carbon $endDate, int $month, int $year): array
    {
        // 1. Delete previous snapshot if generating draft anew
        PayslipDetail::where('salary_id', $salary->id)->delete();

        $statutoryEarnings = $this->buildStatutoryEarningsSnapshot($salary, $context);
        $dynamicResult = $this->buildDynamicComponentsSnapshot($salary, $user, $context, $startDate, $endDate, $month, $year);
        $statutoryDeductions = $this->buildStatutoryDeductionsSnapshot($salary, $context);

        $snapshotDetails = array_merge($statutoryEarnings, $dynamicResult['details'], $statutoryDeductions);

        // Bulk insert the immutable snapshot details
        PayslipDetail::insert($snapshotDetails);

        return [
            'dynamic_earnings' => $dynamicResult['total_earnings'],
            'dynamic_deductions' => $dynamicResult['total_deductions'],
            'count' => count($snapshotDetails),
        ];
    }
}
