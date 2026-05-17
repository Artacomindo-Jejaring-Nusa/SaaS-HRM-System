<?php

namespace App\Http\Controllers\Api;

use App\Exports\PayrollExport;
use App\Exports\PayrollRekapExport;
use App\Http\Controllers\Controller;
use App\Imports\EmployeePayrollImport;
use App\Models\Holiday;
use App\Models\PayrollBatch;
use App\Models\PayrollSetting;
use App\Models\Salary;
use App\Models\User;
use App\Services\PayrollService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use Maatwebsite\Excel\Facades\Excel;

class PayrollController extends Controller
{
    protected $payrollService;

    public function __construct(PayrollService $payrollService)
    {
        $this->payrollService = $payrollService;
    }

    // ─────────────────────────────────────────────
    //  SETTINGS
    // ─────────────────────────────────────────────

    public function getSettings(Request $request)
    {
        $settings = PayrollSetting::firstOrCreate(
            ['company_id' => $request->user()->company_id],
            ['cutoff_day' => 25]
        );

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

        // Load employees with attendance & overtime data
        $users = User::where('company_id', $companyId)
            ->with(['role', 'attendances' => function ($q) use ($monthNum, $year) {
                $q->whereMonth('check_in', $monthNum)->whereYear('check_in', $year);
            }])
            ->with(['overtimes' => function ($q) use ($monthNum, $year) {
                $q->where('status', 'approved')->whereMonth('date', $monthNum)->whereYear('date', $year);
            }])
            ->with(['permits' => function ($q) use ($monthNum, $year) {
                $q->where('status', 'approved')
                    ->where(function ($query) use ($monthNum, $year) {
                        $query->whereMonth('start_date', $monthNum)->whereYear('start_date', $year)
                            ->orWhereMonth('end_date', $monthNum)->whereYear('end_date', $year);
                    });
            }])
            ->get();

        // Calculate total working days in this month (weekdays)
        $startDate = Carbon::createFromDate($year, $monthNum, 1);
        $endDate = $startDate->copy()->endOfMonth();
        $totalWorkingDays = 0;
        for ($d = $startDate->copy(); $d->lte($endDate); $d->addDay()) {
            if (! $d->isWeekend()) {
                $totalWorkingDays++;
            }
        }

        // Fetch holidays for the month
        $holidays = Holiday::where('company_id', $companyId)
            ->whereMonth('date', $monthNum)
            ->whereYear('date', $year)
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

            foreach ($users as $user) {
                $this->processEmployeePayroll($user, $companyId, $batch, $monthName, $year, $holidays, $settings, $totalWorkingDays);
                $processedCount++;
            }

            // Recalculate batch totals
            $batch->recalculateTotals();

            DB::commit();

            return response()->json([
                'message' => "Berhasil memproses $processedCount karyawan.",
                'batch_id' => $batch->id,
                'data' => $batch->fresh()->load('salaries.user'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Gagal generate payroll',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // ─────────────────────────────────────────────
    //  UPDATE INDIVIDUAL SALARY (HR edits)
    // ─────────────────────────────────────────────

    private function getAttendanceMetrics($attendances)
    {
        $totalLateDeduction = 0;
        $totalActualWorkHours = 0;

        foreach ($attendances as $att) {
            if ($att->check_in && $att->check_out) {
                $totalActualWorkHours += Carbon::parse($att->check_in)->diffInHours(Carbon::parse($att->check_out));
            }
            if ($att->check_in) {
                $checkInTime = Carbon::parse($att->check_in);
                $lateThreshold = Carbon::parse($att->check_in)->setTime(9, 0, 0);
                if ($checkInTime->gt($lateThreshold)) {
                    $totalLateDeduction += (($checkInTime->diffInMinutes($lateThreshold) / 60) * 50000);
                }
            }
        }

        return [
            'actual_work_hours' => $totalActualWorkHours,
            'late_deduction' => $totalLateDeduction,
            'attended_days' => $attendances->filter(fn($a) => $a->check_in)->count()
        ];
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

    private function processEmployeePayroll($user, $companyId, $batch, $monthName, $year, $holidays, $settings, $totalWorkingDays)
    {
        $basicSalary = (float) ($user->basic_salary ?? 0);
        
        $attMetrics = $this->getAttendanceMetrics($user->attendances);
        $totalActualWorkHours = $attMetrics['actual_work_hours'];
        $totalLateDeduction = $attMetrics['late_deduction'];
        $attendedDays = $attMetrics['attended_days'];

        $paidLeaveDays = 0;
        foreach ($user->permits as $permit) {
            if (in_array(strtolower($permit->type), ['sakit', 'sick'])) {
                $paidLeaveDays += Carbon::parse($permit->start_date)->diffInDays(Carbon::parse($permit->end_date)) + 1;
            }
        }

        $absentDays = max(0, $totalWorkingDays - ($attendedDays + $paidLeaveDays));
        $totalAbsenceDeduction = $absentDays * ($totalWorkingDays > 0 ? ($basicSalary / $totalWorkingDays) : 0);

        $regularRate = $settings->overtime_rate_per_hour ?? 30000;
        $holidayRate = $settings->overtime_rate_holiday_per_hour ?? 50000;
        
        $otMetrics = $this->getOvertimeMetrics($user->overtimes, $holidays, $regularRate, $holidayRate);
        $totalOvertimeHours = $otMetrics['hours'];
        $overtimeAmount = $otMetrics['amount'];

        $bpjs = $this->payrollService->calculateBPJS($basicSalary, $settings);

        $salary = new Salary;
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
        $totalFixedAllowance = (float) ($user->fixed_allowance ?? 0);
        $salary->earning_attendance_allowance = $attendedDays * ($totalWorkingDays > 0 ? ($totalFixedAllowance / $totalWorkingDays) : 0);
        $salary->earning_overtime = $overtimeAmount;
        $salary->deduction_bpjs_jht = $bpjs['jht']['employee'] ?? 0;
        $salary->deduction_bpjs_jp = $bpjs['jp']['employee'] ?? 0;
        $salary->deduction_absence = $totalAbsenceDeduction;
        $salary->deduction_late = $totalLateDeduction;
        $salary->deduction_tax = $this->payrollService->calculatePPh21TER($basicSalary + $overtimeAmount, $user->ptkp_status);
        $salary->bank_name = $user->bank_name ?? '-';
        $salary->bank_account_no = $user->bank_account_no ?? '-';
        $salary->cost_center = $user->cost_center ?? 'PT. Artacomindo Jejaring Nusa';
        $salary->status = 'draft';

        $salary->calculateTotals();
        $salary->details = json_encode([
            'ptkp' => $user->ptkp_status,
            'tax' => $salary->deduction_tax,
            'bpjs' => $bpjs,
            'overtime' => $overtimeAmount,
            'total_work_hours' => $totalActualWorkHours,
            'total_overtime_hours' => $totalOvertimeHours,
            'breakdown' => ['gross' => $salary->total_earnings, 'net' => $salary->net_salary],
        ]);
        $salary->save();
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
            'earning_others_note', 'deduction_absence', 'cost_center',
            'bank_name', 'bank_account_no', 'bank_account_name',
        ];

        $salary->fill($request->only($editableFields));
        $salary->calculateTotals();

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

    // ─────────────────────────────────────────────
    //  BATCH OPERATIONS (Approval Workflow)
    // ─────────────────────────────────────────────

    public function getBatches(Request $request)
    {
        $batches = PayrollBatch::where('company_id', $request->user()->company_id)
            ->with(['creator', 'approver'])
            ->orderBy('period_year', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $batches]);
    }

    public function getBatchDetail(Request $request, $id)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->with(['salaries.user', 'creator', 'approver'])
            ->findOrFail($id);

        return response()->json(['data' => $batch]);
    }

    public function submitForApproval(Request $request, $batchId)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->findOrFail($batchId);

        if ($batch->status !== 'draft' && $batch->status !== 'rejected') {
            return response()->json(['message' => 'Batch ini tidak bisa disubmit.'], 422);
        }

        $batch->update([
            'status' => 'pending_approval',
            'submitted_at' => now(),
        ]);

        // Update all salaries status
        Salary::where('batch_id', $batch->id)->update(['status' => 'pending_approval']);

        return response()->json([
            'message' => 'Payroll berhasil disubmit untuk persetujuan CEO.',
            'data' => $batch->fresh(),
        ]);
    }

    public function approveBatch(Request $request, $batchId)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->findOrFail($batchId);

        if ($batch->status !== 'pending_approval') {
            return response()->json(['message' => 'Batch ini tidak dalam status menunggu persetujuan.'], 422);
        }

        $batch->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        // Update all salaries status
        Salary::where('batch_id', $batch->id)->update(['status' => 'approved']);

        return response()->json([
            'message' => 'Payroll berhasil disetujui.',
            'data' => $batch->fresh()->load('approver'),
        ]);
    }

    public function rejectBatch(Request $request, $batchId)
    {
        $request->validate(['rejection_note' => 'required|string']);

        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->findOrFail($batchId);

        if ($batch->status !== 'pending_approval') {
            return response()->json(['message' => 'Batch ini tidak dalam status menunggu persetujuan.'], 422);
        }

        $batch->update([
            'status' => 'rejected',
            'rejection_note' => $request->rejection_note,
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => 'rejected']);

        return response()->json([
            'message' => 'Payroll ditolak.',
            'data' => $batch->fresh(),
        ]);
    }

    public function markAsPaid(Request $request, $batchId)
    {
        $batch = PayrollBatch::where('company_id', $request->user()->company_id)
            ->findOrFail($batchId);

        if ($batch->status !== 'approved') {
            return response()->json(['message' => 'Batch harus disetujui terlebih dahulu sebelum dibayar.'], 422);
        }

        $batch->update(['status' => 'paid']);
        Salary::where('batch_id', $batch->id)->update(['status' => 'paid']);

        return response()->json([
            'message' => 'Payroll ditandai sudah dibayar.',
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
        $salaries = Salary::where('user_id', $request->user()->id)
            ->whereIn('status', ['approved', 'paid'])
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

    public function importPayrollData(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv',
        ]);

        $import = new EmployeePayrollImport($request->user()->company_id);
        Excel::import($import, $request->file('file'));

        return response()->json([
            'message' => "Berhasil memperbarui {$import->updatedCount} data karyawan.",
            'updated' => $import->updatedCount,
            'skipped' => $import->skippedCount,
            'errors' => $import->errors,
        ]);
    }

    public function downloadSlip(Request $request, $id)
    {
        $salary = Salary::with(['user', 'user.company', 'user.role', 'batch.creator'])->findOrFail($id);

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

        $pdf = Pdf::loadView('pdf.payslip', compact('salary'));

        return $pdf->download("slip_gaji_{$salary->user->name}_{$salary->month}_{$salary->year}.pdf");
    }

    /**
     * Preview slip gaji as rendered HTML (for in-browser viewing)
     */
    public function previewSlip(Request $request, $id)
    {
        $salary = Salary::with(['user', 'user.company', 'user.role', 'batch.creator'])->findOrFail($id);

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

        $html = view('pdf.payslip', compact('salary'))->render();

        if ($request->wantsJson()) {
            return response()->json(['html' => $html]);
        }

        return $html;
    }
}
