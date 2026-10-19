<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PayrollBatch;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\Salary;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DataPurgeService
{
    public static function purgeCurrentMonth(Request $request, User $user, callable $logActivityCallback)
    {
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        if (! $isSuperAdmin) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hanya Super Admin yang berhak melakukan pembersihan data periode.',
            ], 403);
        }

        $module = strtolower($request->input('module', 'all'));
        $targetIds = $request->input('ids');
        $bulkIds = (is_array($targetIds) && count($targetIds) > 0) ? $targetIds : null;

        [$start, $end, $periodLabel] = self::parseDateRange($request);

        $companyScope = function ($q) use ($user) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $q->where('company_id', $user->company_id);
            }
        };

        $deletedCounts = self::initializeDeletedCounts();

        self::executeModulePurge($module, $companyScope, $start, $end, $bulkIds, $deletedCounts);

        $totalRecords = $deletedCounts['reimbursements'] +
            $deletedCounts['fund_requests'] +
            $deletedCounts['leaves'] +
            $deletedCounts['permits'] +
            $deletedCounts['overtimes'] +
            $deletedCounts['attendance_corrections'] +
            $deletedCounts['attendances'] +
            $deletedCounts['tasks'] +
            $deletedCounts['payroll_batches'];

        $moduleDesc = $module === 'all' ? 'semua modul' : "modul {$module}";

        $logActivityCallback(
            'PURGE_MONTHLY_DATA',
            "Pembersihan data {$moduleDesc} periode {$periodLabel}: {$totalRecords} transaksi dan {$deletedCounts['files']} berkas server dihapus",
            null,
            'maintenance',
            null,
            $deletedCounts
        );

        return response()->json([
            'status' => 'success',
            'message' => "Pembersihan {$moduleDesc} ({$periodLabel}) berhasil. {$totalRecords} data dan {$deletedCounts['files']} berkas server berhasil dihapus.",
            'data' => $deletedCounts,
        ]);
    }

    private static function initializeDeletedCounts(): array
    {
        return [
            'reimbursements' => 0,
            'fund_requests' => 0,
            'leaves' => 0,
            'permits' => 0,
            'overtimes' => 0,
            'attendance_corrections' => 0,
            'attendances' => 0,
            'tasks' => 0,
            'payroll_batches' => 0,
            'files' => 0,
        ];
    }

    private static function parseDateRange(Request $request): array
    {
        $period = $request->input('period', Carbon::now()->format('Y-m'));

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = Carbon::parse($request->input('start_date'))->startOfDay();
            $end = Carbon::parse($request->input('end_date'))->endOfDay();
            $label = $start->format('d/m/Y').' - '.$end->format('d/m/Y');
        } elseif ($period === 'all') {
            $start = Carbon::parse('2000-01-01')->startOfDay();
            $end = Carbon::now()->addYears(5)->endOfDay();
            $label = 'Semua Periode';
        } elseif (preg_match('/^\d{4}$/', $period)) {
            $start = Carbon::parse($period.'-01-01')->startOfYear();
            $end = Carbon::parse($period.'-12-31')->endOfYear();
            $label = "Tahun {$period}";
        } else {
            $start = Carbon::parse($period.'-01')->startOfMonth();
            $end = Carbon::parse($period.'-01')->endOfMonth();
            $label = Carbon::parse($period.'-01')->translatedFormat('F Y');
        }

        return [$start, $end, $label];
    }

    private static function executeModulePurge(
        string $module,
        \Closure $companyScope,
        $start,
        $end,
        ?array $bulkIds,
        array &$deletedCounts
    ): void {
        self::purgeOperationalRecords($module, $companyScope, $start, $end, $bulkIds, $deletedCounts);
        self::purgeAttendanceAndTaskRecords($module, $companyScope, $start, $end, $bulkIds, $deletedCounts);
    }

    private static function purgeOperationalRecords(
        string $module,
        \Closure $companyScope,
        $start,
        $end,
        ?array $bulkIds,
        array &$deletedCounts
    ): void {
        if ($module === 'all' || $module === 'reimbursements') {
            $reimResult = self::purgeReimbursements($companyScope, $start, $end, $bulkIds);
            $deletedCounts['reimbursements'] = $reimResult['count'];
            $deletedCounts['files'] += $reimResult['files'];
        }

        if ($module === 'all' || $module === 'fund_requests') {
            $fundResult = self::purgeFundRequests($companyScope, $start, $end, $bulkIds);
            $deletedCounts['fund_requests'] = $fundResult['count'];
            $deletedCounts['files'] += $fundResult['files'];
        }

        if ($module === 'all' || $module === 'overtimes') {
            $deletedCounts['overtimes'] = self::purgeOvertimes($companyScope, $start, $end, $bulkIds);
        }

        if ($module === 'all' || $module === 'leaves') {
            $leaveResult = self::purgeLeaves($companyScope, $start, $end, $bulkIds);
            $deletedCounts['leaves'] = $leaveResult['count'];
            $deletedCounts['files'] += $leaveResult['files'];
        }

        if ($module === 'all' || $module === 'permits') {
            $permitResult = self::purgePermits($companyScope, $start, $end, $bulkIds);
            $deletedCounts['permits'] = $permitResult['count'];
            $deletedCounts['files'] += $permitResult['files'];
        }
    }

    private static function purgeAttendanceAndTaskRecords(
        string $module,
        \Closure $companyScope,
        $start,
        $end,
        ?array $bulkIds,
        array &$deletedCounts
    ): void {
        if ($module === 'all' || $module === 'attendance_corrections') {
            $deletedCounts['attendance_corrections'] = self::purgeAttendanceCorrections($companyScope, $start, $end, $bulkIds);
        }

        if ($module === 'all' || $module === 'attendance' || $module === 'attendances') {
            $attResult = self::purgeAttendances($companyScope, $start, $end, $bulkIds);
            $deletedCounts['attendances'] = $attResult['count'];
            $deletedCounts['files'] += $attResult['files'];
        }

        if ($module === 'all' || $module === 'tasks') {
            $deletedCounts['tasks'] = self::purgeTasks($companyScope, $start, $end, $bulkIds);
        }

        if ($module === 'all' || $module === 'payroll') {
            $deletedCounts['payroll_batches'] = self::purgePayroll($companyScope, $start, $end, $bulkIds);
        }
    }

    private static function purgeLeaves(\Closure $companyScope, $start, $end, ?array $targetIds): array
    {
        $query = Leave::query();
        if ($targetIds) {
            $query->whereIn('id', $targetIds);
        } else {
            $query->where(function ($q) use ($start, $end) {
                $q->whereBetween('start_date', [$start->toDateString(), $end->toDateString()])
                    ->orWhereBetween('created_at', [$start, $end]);
            });
        }
        $companyScope($query);
        $records = $query->get();
        $files = 0;
        foreach ($records as $l) {
            if ($l->attachment) {
                $files += self::deleteStorageFiles($l->attachment);
            }
            $l->delete();
        }

        return ['count' => $records->count(), 'files' => $files];
    }

    private static function purgePermits(\Closure $companyScope, $start, $end, ?array $targetIds): array
    {
        $query = Permit::query();
        if ($targetIds) {
            $query->whereIn('id', $targetIds);
        } else {
            $query->where(function ($q) use ($start, $end) {
                $q->whereBetween('start_date', [$start->toDateString(), $end->toDateString()])
                    ->orWhereBetween('created_at', [$start, $end]);
            });
        }
        $companyScope($query);
        $records = $query->get();
        $files = 0;
        foreach ($records as $p) {
            if ($p->attachment) {
                $files += self::deleteStorageFiles($p->attachment);
            }
            $p->delete();
        }

        return ['count' => $records->count(), 'files' => $files];
    }

    private static function purgeAttendanceCorrections(\Closure $companyScope, $start, $end, ?array $targetIds): int
    {
        $query = AttendanceCorrection::query();
        if ($targetIds) {
            $query->whereIn('id', $targetIds);
        } else {
            $query->whereBetween('created_at', [$start, $end]);
        }
        $companyScope($query);

        return $query->delete();
    }

    private static function purgeAttendances(\Closure $companyScope, $start, $end, ?array $targetIds): array
    {
        $query = Attendance::query();
        if ($targetIds) {
            $query->whereIn('id', $targetIds);
        } else {
            $query->where(function ($q) use ($start, $end) {
                $q->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                    ->orWhereBetween('check_in', [$start, $end]);
            });
        }
        $companyScope($query);
        $records = $query->get();
        $files = 0;
        foreach ($records as $att) {
            if ($att->image_in) {
                $files += self::deleteStorageFiles($att->image_in);
            }
            if ($att->image_out) {
                $files += self::deleteStorageFiles($att->image_out);
            }
            $att->delete();
        }

        return ['count' => $records->count(), 'files' => $files];
    }

    private static function purgeTasks(\Closure $companyScope, $start, $end, ?array $targetIds): int
    {
        $query = Task::query();
        if ($targetIds) {
            $query->whereIn('id', $targetIds);
        } else {
            $query->whereBetween('created_at', [$start, $end]);
        }
        $companyScope($query);

        return $query->delete();
    }

    private static function purgePayroll(\Closure $companyScope, $start, $end, ?array $targetIds): int
    {
        if ($targetIds) {
            $salaryQuery = Salary::query()->whereIn('id', $targetIds);
            $companyScope($salaryQuery);
            $deletedSalaries = $salaryQuery->delete();

            $batchQuery = PayrollBatch::query()->whereIn('id', $targetIds);
            $companyScope($batchQuery);
            $batches = $batchQuery->get();
            foreach ($batches as $b) {
                Salary::where('batch_id', $b->id)->delete();
                $b->delete();
            }

            return $deletedSalaries;
        }

        $batchQuery = PayrollBatch::query()->whereBetween('created_at', [$start, $end]);
        $companyScope($batchQuery);
        $batches = $batchQuery->get();
        foreach ($batches as $batch) {
            Salary::where('batch_id', $batch->id)->delete();
            $batch->delete();
        }

        $orphanSalaryQuery = Salary::query()->whereBetween('created_at', [$start, $end]);
        $companyScope($orphanSalaryQuery);
        $orphanSalaryQuery->delete();

        return $batches->count();
    }

    private static function deleteStorageFiles(mixed $attachments): int
    {
        if (empty($attachments)) {
            return 0;
        }
        $files = is_array($attachments) ? $attachments : [$attachments];
        $count = 0;
        foreach ($files as $file) {
            if ($file && Storage::disk('public')->exists($file)) {
                Storage::disk('public')->delete($file);
                $count++;
            }
        }

        return $count;
    }

    private static function purgeReimbursements(\Closure $companyScope, $start, $end, ?array $targetIds = null): array
    {
        $reimQuery = Reimbursement::query();
        if ($targetIds) {
            $reimQuery->whereIn('id', $targetIds);
        } else {
            $reimQuery->whereBetween('created_at', [$start, $end]);
        }
        $companyScope($reimQuery);
        $reimbursements = $reimQuery->get();
        $filesCount = 0;

        foreach ($reimbursements as $reim) {
            $filesCount += self::deleteStorageFiles($reim->attachment);
            $reim->delete();
        }

        return ['count' => $reimbursements->count(), 'files' => $filesCount];
    }

    private static function purgeFundRequests(\Closure $companyScope, $start, $end, ?array $targetIds = null): array
    {
        $fundQuery = FundRequest::query();
        if ($targetIds) {
            $fundQuery->whereIn('id', $targetIds);
        } else {
            $fundQuery->whereBetween('created_at', [$start, $end]);
        }
        $companyScope($fundQuery);
        $fundRequests = $fundQuery->get();
        $filesCount = 0;

        foreach ($fundRequests as $fund) {
            $filesCount += self::deleteStorageFiles($fund->attachment);
            $fund->delete();
        }

        return ['count' => $fundRequests->count(), 'files' => $filesCount];
    }

    private static function purgeOvertimes(\Closure $companyScope, $start, $end, ?array $targetIds = null): int
    {
        $otQuery = Overtime::with('items');
        if ($targetIds) {
            $otQuery->whereIn('id', $targetIds);
        } else {
            $otQuery->where(function ($q) use ($start, $end) {
                $q->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                    ->orWhereBetween('created_at', [$start, $end]);
            });
        }
        $companyScope($otQuery);
        $overtimes = $otQuery->get();

        foreach ($overtimes as $ot) {
            $ot->items()->delete();
            $ot->delete();
        }

        return $overtimes->count();
    }
}
