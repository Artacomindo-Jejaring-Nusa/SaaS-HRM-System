<?php

namespace App\Http\Controllers\Api;

use App\Exports\EmployeePayrollTemplateExport;
use App\Exports\PayrollExport;
use App\Exports\PayrollRekapExport;
use App\Http\Controllers\Controller;
use App\Imports\EmployeePayrollImport;
use App\Models\Holiday;
use App\Models\PayrollBatch;
use App\Models\PayrollSetting;
use App\Models\Salary;
use App\Models\User;
use App\Services\DynamicPayrollEngine;
use App\Services\PayrollService;
use App\Services\ApprovalService;
use App\Traits\Notifiable;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use Maatwebsite\Excel\Facades\Excel;

class PayrollController extends Controller
{
    use Notifiable;

    private const ROUTE_PAYROLL_APPROVAL = '/dashboard/payroll/approval';

    protected $payrollService;
    protected $dynamicEngine;

    public function __construct(PayrollService $payrollService, DynamicPayrollEngine $dynamicEngine)
    {
        $this->payrollService = $payrollService;
        $this->dynamicEngine = $dynamicEngine;
    }

    // ─────────────────────────────────────────────
    //  SETTINGS
    // ─────────────────────────────────────────────

    public function getSettings(Request $request)
    {
        $settings = PayrollSetting::firstOrCreate(
            ['company_id' => $request->user()->company_id],
            [
                'cutoff_day' => 25,
                'late_deduction_enabled' => true,
                'late_deduction_base' => 'daily_salary',
                'late_grace_period_minutes' => 0,
                'late_deduction_tiers' => PayrollSetting::defaultLateTiers(),
                'absence_deduction_enabled' => true,
                'absence_deduction_base' => 'daily_salary',
                'absence_deduction_pct' => 100.00,
                'absence_forfeit_allowance' => true,
            ]
        );

        if (empty($settings->late_deduction_tiers)) {
            $settings->late_deduction_tiers = PayrollSetting::defaultLateTiers();
        }

        return response()->json(['data' => $settings]);
    }

    public function updateSettings(Request $request)
    {
        $settings = PayrollSetting::updateOrCreate(
            ['company_id' => $request->user()->company_id],
            $request->all()
        );

        return response()->json(['message' => 'Settings updated', 'data' => $settings]);
    }

    // ─────────────────────────────────────────────
    //  GENERATE PAYROLL (Enhanced with all components)
    // ─────────────────────────────────────────────

    public function generate(Request $request)
    {
        $request->validate([
            'month' => 'required',
            'year' => 'required|integer',
        ]);

        $companyId = $request->user()->company_id;
        $monthName = $request->month;
        $monthNum = Carbon::parse($request->month)->month;
        $year = $request->year;

        // Check if batch already exists
        $existingBatch = PayrollBatch::where([
            'company_id' => $companyId,
            'period_month' => $monthName,
            'period_year' => $year,
        ])->first();

        if ($existingBatch && in_array($existingBatch->status, ['approved', 'paid'])) {
            return response()->json(['message' => 'Payroll untuk periode ini sudah disetujui/dibayar. Tidak bisa generate ulang.'], 422);
        }

        // If draft/pending exists, delete and re-generate
        if ($existingBatch && in_array($existingBatch->status, ['draft', 'rejected'])) {
            Salary::where('batch_id', $existingBatch->id)->delete();
            $existingBatch->delete();
        }

        $settings = PayrollSetting::where('company_id', $companyId)->first();
        if (! $settings) {
            return response()->json(['message' => 'Silakan konfigurasi payroll settings terlebih dahulu.'], 422);
        }

        $cutoffDay = $settings->cutoff_day ?? 20;

        if ($cutoffDay >= 28 || $cutoffDay <= 0) {
            $startDate = Carbon::createFromDate($year, $monthNum, 1)->startOfDay();
            $endDate = $startDate->copy()->endOfMonth()->endOfDay();
        } else {
            $endDate = Carbon::createFromDate($year, $monthNum, $cutoffDay)->endOfDay();
            $startDate = $endDate->copy()->subMonth()->addDay()->startOfDay();
        }

        // Load employees with attendance, overtime, permits & schedules data
        $users = User::where('company_id', $companyId)
            ->with(['role', 'attendances' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('check_in', [$startDate, $endDate]);
            }])
            ->with(['overtimes' => function ($q) use ($startDate, $endDate) {
                $q->where('status', 'approved')->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()]);
            }])
            ->with(['permits' => function ($q) use ($startDate, $endDate) {
                $q->where('status', 'approved')
                    ->where(function ($query) use ($startDate, $endDate) {
                        $query->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                            ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()]);
                    });
            }])
            ->with(['schedules' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->with('shift');
            }])
            ->get();

        // Calculate total working days in this period (weekdays)
        $totalWorkingDays = 0;
        for ($d = $startDate->copy(); $d->lte($endDate); $d->addDay()) {
            if (! $d->isWeekend()) {
                $totalWorkingDays++;
            }
        }

        // Fetch holidays for the period
        $holidays = Holiday::where('company_id', $companyId)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->pluck('date')
            ->toArray();

        DB::beginTransaction();
        try {
            // Create batch
            $batch = PayrollBatch::create([
                'company_id' => $companyId,
                'period_month' => $monthName,
                'period_year' => $year,
                'status' => 'draft',
                'created_by' => $request->user()->id,
            ]);

            $processedCount = 0;

            $payrollContext = [
                'company_id' => $companyId,
                'batch' => $batch,
                'month_name' => $monthName,
                'year' => $year,
                'holidays' => $holidays,
                'settings' => $settings,
                'total_working_days' => $totalWorkingDays,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'month_num' => $monthNum,
            ];

            foreach ($users as $user) {
                $this->processEmployeePayroll($user, $payrollContext);
                $processedCount++;
            }

            // Recalculate batch totals
            $batch->recalculateTotals();

            DB::commit();

            return response()->json([
                'message' => "Berhasil memproses $processedCount karyawan.",
                'batch_id' => $batch->id,
                'data' => $batch->fresh()->load(['salaries.user', 'salaries.detailsRecords']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Gagal generate payroll',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function getOvertimeMetrics($overtimes, $holidays, $regularRate, $holidayRate)
    {
        $overtimeAmount = 0;
        $totalOvertimeHours = 0;

        foreach ($overtimes as $ot) {
            $hours = Carbon::parse($ot->start_time)->diffInHours(Carbon::parse($ot->end_time));
            $totalOvertimeHours += $hours;
            $isHoliday = in_array(Carbon::parse($ot->date)->format('Y-m-d'), $holidays) || Carbon::parse($ot->date)->isWeekend();
            $overtimeAmount += ($hours * ($isHoliday ? $holidayRate : $regularRate));
        }

        return ['hours' => $totalOvertimeHours, 'amount' => $overtimeAmount];
    }

    private function calculateAttendanceMetrics(
        $user,
        float $basicSalary,
        int $totalWorkingDays,
        float $totalFixedAllowance,
        $settings
    ): array {
        $schedulesMap = [];
        if ($user->schedules) {
            foreach ($user->schedules as $sched) {
                $schedulesMap[$sched->date] = $sched;
            }
        }

        $attendedDays = $user->attendances->filter(fn($a) => $a->check_in)->count();
        $totalActualWorkHours = 0;
        foreach ($user->attendances as $att) {
            if ($att->check_in && $att->check_out) {
                $totalActualWorkHours += Carbon::parse($att->check_in)->diffInHours(Carbon::parse($att->check_out));
            }
        }

        if ($user->attendance_type === 'flexible') {
            return [
                'attended_days' => $totalWorkingDays,
                'total_actual_work_hours' => $totalActualWorkHours,
                'absent_days' => 0,
                'late_deduction' => 0,
                'absence_deduction' => 0,
                'late_result' => [
                    'amount' => 0,
                    'total_late_minutes' => 0,
                    'details' => [],
                    'note' => 'Pola Kehadiran Fleksibel (Bebas Denda Keterlambatan)',
                ],
                'absence_result' => [
                    'amount' => 0,
                    'details' => [],
                    'note' => 'Pola Kehadiran Fleksibel (Bebas Potongan Ketidakhadiran)',
                ],
            ];
        }

        $lateResult = $this->payrollService->calculateLateDeduction(
            $user->attendances,
            $schedulesMap,
            $basicSalary,
            $totalWorkingDays,
            $totalFixedAllowance,
            $settings
        );

        $paidLeaveDays = 0;
        foreach ($user->permits as $permit) {
            if (in_array(strtolower($permit->type), ['sakit', 'sick'])) {
                $paidLeaveDays += Carbon::parse($permit->start_date)->diffInDays(Carbon::parse($permit->end_date)) + 1;
            }
        }

        $absentDays = max(0, $totalWorkingDays - ($attendedDays + $paidLeaveDays));
        $absenceResult = $this->payrollService->calculateAbsenceDeduction(
            $absentDays,
            $totalWorkingDays,
            $basicSalary,
            $settings
        );

        return [
            'attended_days' => $attendedDays,
            'total_actual_work_hours' => $totalActualWorkHours,
            'absent_days' => $absentDays,
            'late_deduction' => $lateResult['amount'],
            'absence_deduction' => $absenceResult['amount'],
            'late_result' => $lateResult,
            'absence_result' => $absenceResult,
        ];
    }

    private function processEmployeePayroll($user, array $ctx, ?Salary $existingSalary = null)
    {
        $companyId = $ctx['company_id'];
        $batch = $ctx['batch'];
        $monthName = $ctx['month_name'];
        $year = $ctx['year'];
        $holidays = $ctx['holidays'];
        $settings = $ctx['settings'];
        $totalWorkingDays = $ctx['total_working_days'];
        $startDate = $ctx['start_date'];
        $endDate = $ctx['end_date'];

        $basicSalary = (float) ($user->basic_salary ?? 0);
        $totalFixedAllowance = (float) ($user->fixed_allowance ?? 0);

        $attMetrics = $this->calculateAttendanceMetrics(
            $user,
            $basicSalary,
            $totalWorkingDays,
            $totalFixedAllowance,
            $settings
        );

        $attendedDays = $attMetrics['attended_days'];
        $totalActualWorkHours = $attMetrics['total_actual_work_hours'];
        $absentDays = $attMetrics['absent_days'];
        $totalLateDeduction = $attMetrics['late_deduction'];
        $totalAbsenceDeduction = $attMetrics['absence_deduction'];
        $lateResult = $attMetrics['late_result'];
        $absenceResult = $attMetrics['absence_result'];

        // PP 35/2021: Pola fleksibel khusus atasan/jabatan tertentu bebas jam & tidak menerima klaim lembur otomatis
        if ($user->attendance_type === 'flexible') {
            $totalOvertimeHours = 0;
            $overtimeAmount = 0;
        } else {
            $regularRate = $settings->overtime_rate_per_hour ?? 30000;
            $holidayRate = $settings->overtime_rate_holiday_per_hour ?? 50000;
            
            $otMetrics = $this->getOvertimeMetrics($user->overtimes, $holidays, $regularRate, $holidayRate);
            $totalOvertimeHours = $otMetrics['hours'];
            $overtimeAmount = $otMetrics['amount'];
        }

        $bpjs = $this->payrollService->calculateBPJS($basicSalary, $settings);

        $salary = $existingSalary ?? new Salary;
        $salary->user_id = $user->id;
        $salary->company_id = $companyId;
        $salary->batch_id = $batch->id;
        $salary->month = $monthName;
        $salary->year = $year;
        $salary->basic_salary = $basicSalary;
        $salary->department = $user->role->name ?? '-';
        $salary->working_days = $attendedDays;
        $salary->total_working_days = $totalWorkingDays;
        $salary->earning_bpjs_kes_premium = $bpjs['kesehatan']['company'] ?? 0;
        $salary->earning_attendance_allowance = $attendedDays * ($totalWorkingDays > 0 ? ($totalFixedAllowance / $totalWorkingDays) : 0);
        $salary->earning_overtime = $overtimeAmount;
        $salary->deduction_bpjs_jht = $bpjs['jht']['employee'] ?? 0;
        $salary->deduction_bpjs_jp = $bpjs['jp']['employee'] ?? 0;
        $salary->deduction_bpjs_kes = $bpjs['kesehatan']['employee'] ?? 0;
        $salary->deduction_absence = $totalAbsenceDeduction;
        $salary->deduction_late = $totalLateDeduction;

        // Calculate PPh 21 dynamically based on settings tax method (TER, Gross, Gross-Up)
        $taxGrossSalary = (float) $basicSalary
            + (float) $overtimeAmount
            + (float) $salary->earning_attendance_allowance
            + (float) ($salary->earning_position_allowance ?? 0)
            + (float) ($salary->earning_communication_allowance ?? 0)
            + (float) ($salary->earning_shift_premium ?? 0)
            + (float) ($salary->earning_shift_meal ?? 0)
            + (float) ($salary->earning_operational ?? 0)
            + (float) ($salary->earning_diligence_bonus ?? 0)
            + (float) ($salary->earning_backpay ?? 0)
            + (float) ($bpjs['kesehatan']['company'] ?? 0)
            + (float) ($bpjs['jkm']['company'] ?? 0)
            + (float) ($bpjs['jkk']['company'] ?? 0);
        $taxMethod = $settings->tax_method ?? 'TER';
        $taxResult = $this->payrollService->calculatePPh21($taxGrossSalary, $user->ptkp_status, $taxMethod);
        
        $salary->deduction_tax = $taxResult['tax'];
        
        // If Gross Up, we need to add the tax allowance as an earning so it offsets the tax deduction!
        if (strtoupper($taxMethod) === 'GROSS_UP' && $taxResult['tax'] > 0) {
            $salary->earning_others = ($salary->earning_others ?? 0) + $taxResult['tax'];
            $salary->earning_others_note = trim(($salary->earning_others_note ?? '') . ' Tunjangan Pajak (Gross-Up)');
        }

        $salary->bank_name = $user->bank_name ?? '-';
        $salary->bank_account_no = $user->bank_account_no ?? '-';
        $salary->cost_center = $user->cost_center ?: ($user->company?->name ?? 'Cost Center Utama');
        $salary->status = 'draft';

        $salary->calculateTotals();
        $salary->details = json_encode([
            'ptkp' => $user->ptkp_status,
            'tax' => [
                'amount' => $salary->deduction_tax,
                'method' => $taxResult['method'],
                'details' => $taxResult['details'] ?? [],
            ],
            'bpjs' => $bpjs,
            'overtime' => $overtimeAmount,
            'total_work_hours' => $totalActualWorkHours,
            'total_overtime_hours' => $totalOvertimeHours,
            'discipline' => [
                'late' => $lateResult,
                'absence' => $absenceResult,
            ],
            'breakdown' => ['gross' => $salary->total_earnings, 'net' => $salary->net_salary],
        ]);
        $salary->save();

        // Generate immutable snapshot in payslip_details
        $context = [
            'basic_salary' => $basicSalary,
            'gross_salary' => $salary->total_earnings,
            'attended_days' => $attendedDays,
            'total_working_days' => $totalWorkingDays,
            'absent_days' => $absentDays,
            'overtime_hours' => $totalOvertimeHours,
            'late_minutes' => $lateResult['total_late_minutes'] ?? 0,
            'tenure_years' => $user->join_date ? Carbon::parse($user->join_date)->diffInYears($startDate) : 0,
        ];

        $dynamicResults = $this->dynamicEngine->generateSnapshotDetails(
            $salary,
            $user,
            $context,
            $startDate,
            $endDate,
            (int) $year
        );

        $hasDynamicUpdates = false;
        if (($dynamicResults['dynamic_earnings'] ?? 0) > 0) {
            $salary->earning_others = ($salary->earning_others ?? 0) + $dynamicResults['dynamic_earnings'];
            $hasDynamicUpdates = true;
        }
        if (($dynamicResults['dynamic_deductions'] ?? 0) > 0) {
            $salary->deduction_others = ($salary->deduction_others ?? 0) + $dynamicResults['dynamic_deductions'];
            $hasDynamicUpdates = true;
        }
        if ($hasDynamicUpdates) {
            $salary->calculateTotals();
            $detailsData = json_decode($salary->details, true) ?? [];
            $detailsData['breakdown'] = ['gross' => $salary->total_earnings, 'net' => $salary->net_salary];
            $salary->details = json_encode($detailsData);
            $salary->save();
        }
    }

    public function updateSalary(Request $request, $id)
    {
        $salary = Salary::findOrFail($id);

        // Only allow editing if draft or rejected
        if (! in_array($salary->status, ['draft', 'rejected'])) {
            return response()->json(['message' => 'Tidak bisa mengubah gaji yang sudah disetujui.'], 422);
        }

        $editableFields = [
            'earning_position_allowance', 'earning_attendance_allowance',
            'earning_communication_allowance', 'earning_shift_premium',
            'earning_shift_meal', 'earning_overtime', 'earning_operational',
            'earning_diligence_bonus', 'earning_backpay', 'earning_others',
            'earning_others_note', 'deduction_absence', 'deduction_late',
            'deduction_tax', 'deduction_others', 'deduction_others_note',
            'cost_center', 'bank_name', 'bank_account_no', 'bank_account_name',
        ];

        $salary->fill($request->only($editableFields));
        $salary->calculateTotals();

        if ($request->filled('ptkp_status') && $salary->user) {
            $salary->user->ptkp_status = $request->ptkp_status;
            $salary->user->save();
        }

        // Update legacy details JSON
        $details = json_decode($salary->details, true) ?? [];
        $details['breakdown'] = [
            'gross' => $salary->total_earnings,
            'net' => $salary->net_salary,
        ];
        $salary->details = json_encode($details);

        $salary->save();

        // Recalculate batch
        if ($salary->batch) {
            $salary->batch->recalculateTotals();
        }

        return response()->json([
            'message' => 'Data gaji berhasil diperbarui.',
            'data' => $salary->fresh()->load('user'),
        ]);
    }

    public function recalculateSalary(Request $request, $id)
    {
        $salary = Salary::findOrFail($id);
        $user = $salary->user;
        $settings = $user ? PayrollSetting::where('company_id', $user->company_id)->first() : null;

        $validationError = $this->getRecalculationValidationError($salary, $user, $settings);
        if ($validationError) {
            return response()->json(['message' => $validationError['message']], $validationError['code']);
        }

        // If Super Admin chose to switch attendance_type or ptkp_status
        $userUpdated = false;
        if ($request->filled('attendance_type')) {
            $user->attendance_type = $request->attendance_type;
            $userUpdated = true;
        }
        if ($request->filled('ptkp_status')) {
            $user->ptkp_status = $request->ptkp_status;
            $userUpdated = true;
        }
        if ($userUpdated) {
            $user->save();
        }

        $batch = $salary->batch;
        $companyId = $user->company_id;

        $cutoffDay = $settings->cutoff_day ?? 20;
        $monthNum = Carbon::parse($batch->period_month)->month;
        $year = $batch->period_year;

        if ($cutoffDay >= 28 || $cutoffDay <= 0) {
            $startDate = Carbon::createFromDate($year, $monthNum, 1)->startOfDay();
            $endDate = $startDate->copy()->endOfMonth()->endOfDay();
        } else {
            $endDate = Carbon::createFromDate($year, $monthNum, $cutoffDay)->endOfDay();
            $startDate = $endDate->copy()->subMonth()->addDay()->startOfDay();
        }

        $user->load([
            'role',
            'attendances' => fn ($q) => $q->whereBetween('check_in', [$startDate, $endDate]),
            'overtimes' => fn ($q) => $q->where('status', 'approved')->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()]),
            'permits' => fn ($q) => $q->where('status', 'approved')->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()]);
            }),
            'schedules' => fn ($q) => $q->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])->with('shift'),
        ]);

        $totalWorkingDays = 0;
        for ($d = $startDate->copy(); $d->lte($endDate); $d->addDay()) {
            if (! $d->isWeekend()) {
                $totalWorkingDays++;
            }
        }

        $holidays = Holiday::where('company_id', $companyId)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->pluck('date')
            ->toArray();

        $ctx = [
            'company_id' => $companyId,
            'batch' => $batch,
            'month_name' => $batch->period_month,
            'year' => $year,
            'holidays' => $holidays,
            'settings' => $settings,
            'total_working_days' => $totalWorkingDays,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'month_num' => $monthNum,
        ];

        $this->processEmployeePayroll($user, $ctx, $salary);
        $batch->recalculateTotals();

        return response()->json([
            'message' => 'Gaji karyawan berhasil dikalkulasi ulang.',
            'data' => $salary->fresh()->load(['user', 'detailsRecords']),
        ]);
    }

    private function getRecalculationValidationError(Salary $salary, ?User $user, ?PayrollSetting $settings): ?array
    {
        $batch = $salary->batch;
        $error = null;

        if (! in_array($salary->status, ['draft', 'rejected'])) {
            $error = ['message' => 'Hanya gaji berstatus draft yang bisa dikalkulasi ulang.', 'code' => 422];
        } elseif (! $batch || ! in_array($batch->status, ['draft', 'rejected'])) {
            $error = ['message' => 'Batch payroll sudah tidak berstatus draft.', 'code' => 422];
        } elseif (! $user) {
            $error = ['message' => 'Data pegawai tidak ditemukan.', 'code' => 404];
        } elseif (! $settings) {
            $error = ['message' => 'Konfigurasi payroll tidak ditemukan.', 'code' => 422];
        }

        return $error;
    }

    // ─────────────────────────────────────────────
    //  BATCH OPERATIONS (Approval Workflow)
    // ─────────────────────────────────────────────

    public function getBatches(Request $request)
    {
        $query = PayrollBatch::with(['creator', 'approver'])
            ->orderBy('period_year', 'desc')
            ->orderBy('created_at', 'desc');

        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($request->has('status') && !empty($request->status)) {
            $query->where('status', $request->status);
        }

        $batches = $query->get();

        $user = $request->user();
        $batches->each(function ($b) use ($user) {
            if (!empty($b->current_approval_step)) {
                $b->current_step_info = ApprovalService::getCurrentStepInfo('payroll', $b->company_id, $b->current_approval_step, $b->creator);
                $submitter = $b->creator ?: $user;
                $b->can_user_approve = ApprovalService::canApprove('payroll', $b->company_id, $user, $submitter, $b->current_approval_step);
            } else {
                $b->can_user_approve = $user->role_id === 1 || $user->hasPermission('approve-payroll') || $user->hasPermission('manage-payroll');
            }
        });

        return response()->json(['data' => $batches]);
    }

    public function getBatchDetail(Request $request, $id)
    {
        $query = PayrollBatch::with(['salaries.user', 'salaries.detailsRecords', 'creator', 'approver']);

        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        $batch = $query->findOrFail($id);

        $user = $request->user();
        if (!empty($batch->current_approval_step)) {
            $batch->current_step_info = ApprovalService::getCurrentStepInfo('payroll', $batch->company_id, $batch->current_approval_step, $batch->creator);
            $submitter = $batch->creator ?: $user;
            $batch->can_user_approve = ApprovalService::canApprove('payroll', $batch->company_id, $user, $submitter, $batch->current_approval_step);
        } else {
            $batch->can_user_approve = $user->role_id === 1 || $user->hasPermission('approve-payroll') || $user->hasPermission('manage-payroll');
        }

        return response()->json(['data' => $batch]);
    }

    private function getAccessibleBatch($user, $batchId, array $with = []): PayrollBatch
    {
        $query = PayrollBatch::query();
        if (!empty($with)) {
            $query->with($with);
        }
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }
        return $query->findOrFail($batchId);
    }

    public function submitForApproval(Request $request, $batchId)
    {
        $user = $request->user();
        $batch = $this->getAccessibleBatch($user, $batchId);

        if ($batch->status !== 'draft' && $batch->status !== 'rejected') {
            return response()->json(['message' => 'Batch ini tidak bisa disubmit.'], 422);
        }

        $companyId = $batch->company_id ?: $user->company_id;
        $workflowResult = ApprovalService::initApproval('payroll', $companyId, $user);

        if ($workflowResult) {
            return $this->handleWorkflowSubmission($batch, $workflowResult, $user);
        }

        return $this->handleDefaultSubmission($batch, $user);
    }

    private function handleWorkflowSubmission(PayrollBatch $batch, array $workflowResult, $user)
    {
        $isAutoApproved = $workflowResult['status'] === 'approved';
        $batchStatus = $isAutoApproved ? 'approved' : 'pending_approval';

        $batch->update([
            'status' => $batchStatus,
            'current_approval_step' => $workflowResult['current_approval_step'],
            'created_by' => $batch->created_by ?: $user->id,
            'submitted_at' => now(),
            'approved_at' => $isAutoApproved ? now() : null,
            'approved_by' => $isAutoApproved ? $user->id : null,
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => $batchStatus]);

        if (!empty($workflowResult['approvers'])) {
            foreach ($workflowResult['approvers'] as $approver) {
                $this->notify(
                    $approver,
                    'PERSETUJUAN PAYROLL',
                    "Batch payroll periode {$batch->period_month} {$batch->period_year} memerlukan persetujuan Anda ({$workflowResult['step_label']}).",
                    'warning',
                    self::ROUTE_PAYROLL_APPROVAL
                );
            }
        }

        return response()->json([
            'message' => $isAutoApproved ? 'Payroll otomatis disetujui sesuai aturan workflow.' : 'Payroll berhasil disubmit untuk persetujuan berjenjang.',
            'data' => $batch->fresh(),
        ]);
    }

    private function handleDefaultSubmission(PayrollBatch $batch, $user)
    {
        $batch->update([
            'status' => 'pending_approval',
            'current_approval_step' => 1,
            'created_by' => $batch->created_by ?: $user->id,
            'submitted_at' => now(),
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => 'pending_approval']);

        return response()->json([
            'message' => 'Payroll berhasil disubmit untuk persetujuan.',
            'data' => $batch->fresh(),
        ]);
    }

    public function approveBatch(Request $request, $batchId)
    {
        $user = $request->user();
        $batch = $this->getAccessibleBatch($user, $batchId, ['creator', 'company']);

        if ($batch->status !== 'pending_approval') {
            return response()->json(['message' => 'Batch ini tidak dalam status menunggu persetujuan.'], 422);
        }

        if ($batch->current_approval_step !== null) {
            return $this->handleWorkflowBatchApproval($batch, $user);
        }

        return $this->handleDirectBatchApproval($batch, $user);
    }

    private function handleWorkflowBatchApproval(PayrollBatch $batch, $user)
    {
        $submitter = $batch->creator ?: $user;
        $companyId = $batch->company_id ?: $user->company_id;

        $result = ApprovalService::processApproval(
            'payroll',
            $companyId,
            $user,
            $submitter,
            $batch->current_approval_step,
            'approve'
        );

        if ($result && isset($result['error'])) {
            return response()->json(['message' => $result['error']], 403);
        }

        if ($result) {
            return !empty($result['is_final'])
                ? $this->finalizeWorkflowPayrollApproval($batch, $user, $companyId)
                : $this->advanceWorkflowPayrollApproval($batch, $result);
        }

        return $this->handleDirectBatchApproval($batch, $user);
    }

    private function finalizeWorkflowPayrollApproval(PayrollBatch $batch, $user, $companyId)
    {
        $batch->update([
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => 'approved']);

        $this->notifySuperAdmins(
            $companyId,
            'PAYROLL DISETUJUI',
            "Batch payroll periode {$batch->period_month} {$batch->period_year} telah disetujui sepenuhnya oleh {$user->name}.",
            'success',
            self::ROUTE_PAYROLL_APPROVAL,
            $user->id
        );

        return response()->json([
            'message' => 'Payroll berhasil disetujui sepenuhnya sesuai alur.',
            'data' => $batch->fresh()->load('approver'),
        ]);
    }

    private function advanceWorkflowPayrollApproval(PayrollBatch $batch, array $result)
    {
        $batch->update([
            'status' => 'pending_approval',
            'current_approval_step' => $result['current_approval_step'],
        ]);

        if (isset($result['approvers'])) {
            foreach ($result['approvers'] as $nextApprover) {
                $this->notify(
                    $nextApprover,
                    'PERSETUJUAN PAYROLL TAHAP BERIKUTNYA',
                    "Batch payroll periode {$batch->period_month} {$batch->period_year} siap untuk tahap persetujuan Anda ({$result['step_label']}).",
                    'info',
                    self::ROUTE_PAYROLL_APPROVAL
                );
            }
        }

        return response()->json([
            'message' => "Persetujuan tahap {$batch->current_approval_step} berhasil. Berlanjut ke tahap persetujuan berikutnya ({$result['step_label']}).",
            'data' => $batch->fresh()->load('approver'),
        ]);
    }

    private function handleDirectBatchApproval(PayrollBatch $batch, $user)
    {
        if ($user->role_id !== 1 && ! $user->hasPermission('approve-payroll') && ! $user->hasPermission('manage-payroll')) {
            return response()->json(['message' => 'Anda tidak memiliki hak akses untuk Setujui Payroll.'], 403);
        }

        $batch->update([
            'status' => 'approved',
            'current_approval_step' => null,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => 'approved']);

        return response()->json([
            'message' => 'Payroll berhasil disetujui.',
            'data' => $batch->fresh()->load('approver'),
        ]);
    }

    public function rejectBatch(Request $request, $batchId)
    {
        $user = $request->user();
        $request->validate(['rejection_note' => 'required|string']);

        $batch = $this->getAccessibleBatch($user, $batchId, ['creator', 'company']);

        if ($batch->status !== 'pending_approval') {
            return response()->json(['message' => 'Batch ini tidak dalam status menunggu persetujuan.'], 422);
        }

        $authError = $this->validateRejectAuthorization($batch, $user);
        if ($authError) {
            return response()->json(['message' => $authError], 403);
        }

        $batch->update([
            'status' => 'rejected',
            'current_approval_step' => null,
            'rejection_note' => $request->rejection_note,
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => 'rejected']);

        if ($batch->creator) {
            $this->notify(
                $batch->creator,
                'PAYROLL DITOLAK (REVISI)',
                "Batch payroll periode {$batch->period_month} {$batch->period_year} ditolak oleh {$user->name}. Catatan: {$request->rejection_note}",
                'danger',
                '/dashboard/payroll'
            );
        }

        return response()->json([
            'message' => 'Payroll ditolak untuk revisi.',
            'data' => $batch->fresh(),
        ]);
    }

    private function validateRejectAuthorization(PayrollBatch $batch, $user): ?string
    {
        if ($batch->current_approval_step !== null) {
            $submitter = $batch->creator ?: $user;
            $companyId = $batch->company_id ?: $user->company_id;
            $result = ApprovalService::processApproval(
                'payroll',
                $companyId,
                $user,
                $submitter,
                $batch->current_approval_step,
                'reject'
            );

            return ($result && isset($result['error'])) ? $result['error'] : null;
        }

        if ($user->role_id !== 1 && ! $user->hasPermission('approve-payroll') && ! $user->hasPermission('manage-payroll')) {
            return 'Anda tidak memiliki hak akses untuk menolak payroll.';
        }

        return null;
    }

    public function markAsPaid(Request $request, $batchId)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->with(['salaries.user'])
            ->findOrFail($batchId);

        if ($batch->status !== 'approved') {
            return response()->json(['message' => 'Batch harus disetujui (Approved) terlebih dahulu sebelum dibagikan dan dibayar.'], 422);
        }

        $batch->update(['status' => 'paid']);
        Salary::where('batch_id', $batch->id)->update(['status' => 'paid']);

        // Send notifications to all employees in the batch that their payslip is published
        foreach ($batch->salaries as $salary) {
            if ($salary->user) {
                $this->notify(
                    $salary->user,
                    'SLIP GAJI TERBIT',
                    "Slip gaji periode {$batch->period_month} {$batch->period_year} Anda telah dibagikan dan dapat dilihat di portal payroll.",
                    'success',
                    '/dashboard/payroll'
                );
            }
        }

        return response()->json([
            'message' => 'Slip gaji berhasil dibagikan ke seluruh karyawan dan periode ditandai selesai.',
            'data' => $batch->fresh(),
        ]);
    }

    // ─────────────────────────────────────────────
    //  HISTORY & LISTING
    // ─────────────────────────────────────────────

    public function index(Request $request)
    {
        $query = Salary::with('user')
            ->where('company_id', $request->user()->company_id);

        if ($request->filled('month') && $request->month !== 'all') {
            $query->where('month', $request->month);
        }

        if ($request->filled('year') && $request->year !== 'all') {
            $query->where('year', $request->year);
        }

        $salaries = $query->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get();

        return response()->json(['data' => $salaries]);
    }

    public function myPayroll(Request $request)
    {
        // Only show payslips that have been published / paid by HR
        $salaries = Salary::where('user_id', $request->user()->id)
            ->where('status', 'paid')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get();

        return response()->json(['data' => $salaries]);
    }

    public function destroyBatch($id)
    {
        $batch = PayrollBatch::findOrFail($id);

        // Only allow deleting draft or rejected batches
        if (! in_array($batch->status, ['draft', 'rejected'])) {
            return response()->json(['message' => 'Hanya draft atau gaji yang ditolak yang bisa dihapus.'], 422);
        }

        DB::beginTransaction();
        try {
            Salary::where('batch_id', $batch->id)->delete();
            $batch->delete();
            DB::commit();

            return response()->json(['message' => 'Draft payroll berhasil dihapus.']);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Gagal menghapus draft payroll.'], 500);
        }
    }

    // ─────────────────────────────────────────────
    //  EXPORT & PDF
    // ─────────────────────────────────────────────

    public function export(Request $request)
    {
        $month = $request->query('month');
        $year = $request->query('year', date('Y'));
        $companyId = $request->user()->company_id;
        $userName = $request->user()->name;

        return Excel::download(
            new PayrollExport($companyId, $month, $year, $userName),
            "payroll_report_{$month}_{$year}.xlsx"
        );
    }

    public function exportRekap(Request $request, $batchId)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->with(['salaries.user', 'creator', 'approver'])
            ->findOrFail($batchId);

        return Excel::download(
            new PayrollRekapExport($batch),
            "Rekap_Gaji_{$batch->period_month}_{$batch->period_year}.xlsx"
        );
    }

    public function exportPayrollTemplate(Request $request)
    {
        $companyId = $request->user()->company_id;

        return Excel::download(
            new EmployeePayrollTemplateExport($companyId),
            'Template_Data_Payroll_Karyawan.xlsx'
        );
    }

    public function importPayrollData(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
        ]);

        $import = new EmployeePayrollImport($request->user()->company_id);
        Excel::import($import, $request->file('file'));

        $totalProcessed = $import->updatedCount + $import->createdCount;
        $msg = "Berhasil memproses {$totalProcessed} data karyawan ({$import->updatedCount} diperbarui, {$import->createdCount} baru ditambahkan).";

        return response()->json([
            'message' => $msg,
            'updated' => $import->updatedCount,
            'created' => $import->createdCount,
            'skipped' => $import->skippedCount,
            'errors' => $import->errors,
        ]);
    }

    public function downloadSlip(Request $request, $id)
    {
        $salary = Salary::with(['user', 'user.company', 'user.role', 'batch.creator', 'detailsRecords'])->findOrFail($id);

        $user = $request->user();

        // Fallback for manual token authentication (for mobile downloads)
        if (! $user && $request->has('token')) {
            $token = PersonalAccessToken::findToken($request->token);
            if ($token) {
                $user = $token->tokenable;
            }
        }

        if (! $user) {
            abort(401);
        }

        // Ensure user belongs to the same company or is the employee themselves
        if ($salary->company_id !== $user->company_id && $salary->user_id !== $user->id) {
            abort(403);
        }

        // Regular employees can only access their slip if HR has published / marked as paid
        $isPayrollAdmin = $user->role_id === 1 || $user->isSuperAdmin() || $user->hasPermission('manage-payroll');
        if (! $isPayrollAdmin && $salary->status !== 'paid') {
            abort(403, 'Slip gaji periode ini belum dibagikan oleh HR.');
        }

        $pdf = Pdf::loadView('pdf.payslip', compact('salary'));

        return $pdf->download("slip_gaji_{$salary->user->name}_{$salary->month}_{$salary->year}.pdf");
    }

    /**
     * Preview slip gaji as rendered HTML (for in-browser viewing)
     */
    public function previewSlip(Request $request, $id)
    {
        $salary = Salary::with(['user', 'user.company', 'user.role', 'batch.creator', 'detailsRecords'])->findOrFail($id);

        $user = $request->user();

        // Fallback for manual token authentication (for mobile viewing)
        if (! $user && $request->has('token')) {
            $token = PersonalAccessToken::findToken($request->token);
            if ($token) {
                $user = $token->tokenable;
            }
        }

        if (! $user) {
            abort(401);
        }

        if ($salary->company_id !== $user->company_id && $salary->user_id !== $user->id) {
            abort(403);
        }

        // Regular employees can only access their slip if HR has published / marked as paid
        $isPayrollAdmin = $user->role_id === 1 || $user->isSuperAdmin() || $user->hasPermission('manage-payroll');
        if (! $isPayrollAdmin && $salary->status !== 'paid') {
            abort(403, 'Slip gaji periode ini belum dibagikan oleh HR.');
        }

        $html = view('pdf.payslip', compact('salary'))->render();

        if ($request->wantsJson()) {
            return response()->json(['html' => $html]);
        }

        return $html;
    }
}
