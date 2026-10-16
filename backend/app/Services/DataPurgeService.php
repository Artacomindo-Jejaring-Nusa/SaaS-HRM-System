<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DataPurgeService
{
    public static function purgeCurrentMonth(Request $request, User $user, callable $logActivityCallback)
    {
        $isSuperAdmin = $user->role_id === 1 || ($user->role && strtolower($user->role->name) === 'super admin');

        if (!$isSuperAdmin) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hanya Super Admin yang berhak melakukan pembersihan data periode.',
            ], 403);
        }

        $module = strtolower($request->input('module', 'all'));
        $targetIds = $request->input('ids');
        $isBulkIds = is_array($targetIds) && count($targetIds) > 0;

        // Parse date range
        $period = $request->input('period', Carbon::now()->format('Y-m'));
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = Carbon::parse($request->input('start_date'))->startOfDay();
            $end = Carbon::parse($request->input('end_date'))->endOfDay();
            $periodLabel = $start->format('d/m/Y') . ' - ' . $end->format('d/m/Y');
        } elseif ($period === 'all') {
            $start = Carbon::parse('2000-01-01')->startOfDay();
            $end = Carbon::now()->addYears(5)->endOfDay();
            $periodLabel = 'Semua Periode';
        } elseif (preg_match('/^\d{4}$/', $period)) {
            $start = Carbon::parse($period . '-01-01')->startOfYear();
            $end = Carbon::parse($period . '-12-31')->endOfYear();
            $periodLabel = "Tahun {$period}";
        } else {
            $start = Carbon::parse($period . '-01')->startOfMonth();
            $end = Carbon::parse($period . '-01')->endOfMonth();
            $periodLabel = Carbon::parse($period . '-01')->translatedFormat('F Y');
        }

        $companyScope = function ($q) use ($user) {
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $q->where('company_id', $user->company_id);
            }
        };

        $deletedCounts = [
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

        // 1. Reimbursements
        if ($module === 'all' || $module === 'reimbursements') {
            $reimResult = self::purgeReimbursements($companyScope, $start, $end, $isBulkIds ? $targetIds : null);
            $deletedCounts['reimbursements'] = $reimResult['count'];
            $deletedCounts['files'] += $reimResult['files'];
        }

        // 2. Fund Requests
        if ($module === 'all' || $module === 'fund_requests') {
            $fundResult = self::purgeFundRequests($companyScope, $start, $end, $isBulkIds ? $targetIds : null);
            $deletedCounts['fund_requests'] = $fundResult['count'];
            $deletedCounts['files'] += $fundResult['files'];
        }

        // 3. Overtimes
        if ($module === 'all' || $module === 'overtimes') {
            $deletedCounts['overtimes'] = self::purgeOvertimes($companyScope, $start, $end, $isBulkIds ? $targetIds : null);
        }

        // 4. Leaves
        if ($module === 'all' || $module === 'leaves') {
            $leaveQuery = Leave::query();
            if ($isBulkIds) {
                $leaveQuery->whereIn('id', $targetIds);
            } else {
                $leaveQuery->where(function ($q) use ($start, $end) {
                    $q->whereBetween('start_date', [$start->toDateString(), $end->toDateString()])
                      ->orWhereBetween('created_at', [$start, $end]);
                });
            }
            $companyScope($leaveQuery);
            $leaves = $leaveQuery->get();
            foreach ($leaves as $l) {
                if ($l->attachment) {
                    $deletedCounts['files'] += self::deleteStorageFiles($l->attachment);
                }
                $l->delete();
            }
            $deletedCounts['leaves'] = $leaves->count();
        }

        // 5. Permits
        if ($module === 'all' || $module === 'permits') {
            $permitQuery = Permit::query();
            if ($isBulkIds) {
                $permitQuery->whereIn('id', $targetIds);
            } else {
                $permitQuery->where(function ($q) use ($start, $end) {
                    $q->whereBetween('start_date', [$start->toDateString(), $end->toDateString()])
                      ->orWhereBetween('created_at', [$start, $end]);
                });
            }
            $companyScope($permitQuery);
            $permits = $permitQuery->get();
            foreach ($permits as $p) {
                if ($p->attachment) {
                    $deletedCounts['files'] += self::deleteStorageFiles($p->attachment);
                }
                $p->delete();
            }
            $deletedCounts['permits'] = $permits->count();
        }

        // 6. Attendance Corrections
        if ($module === 'all' || $module === 'attendance_corrections') {
            $acQuery = AttendanceCorrection::query();
            if ($isBulkIds) {
                $acQuery->whereIn('id', $targetIds);
            } else {
                $acQuery->whereBetween('created_at', [$start, $end]);
            }
            $companyScope($acQuery);
            $deletedCounts['attendance_corrections'] = $acQuery->delete();
        }

        // 7. Attendances
        if ($module === 'all' || $module === 'attendance' || $module === 'attendances') {
            $attQuery = \App\Models\Attendance::query();
            if ($isBulkIds) {
                $attQuery->whereIn('id', $targetIds);
            } else {
                $attQuery->where(function ($q) use ($start, $end) {
                    $q->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                      ->orWhereBetween('check_in', [$start, $end]);
                });
            }
            $companyScope($attQuery);
            $attendances = $attQuery->get();
            foreach ($attendances as $att) {
                if ($att->image_in) {
                    $deletedCounts['files'] += self::deleteStorageFiles($att->image_in);
                }
                if ($att->image_out) {
                    $deletedCounts['files'] += self::deleteStorageFiles($att->image_out);
                }
                $att->delete();
            }
            $deletedCounts['attendances'] = $attendances->count();
        }

        // 8. Tasks
        if ($module === 'all' || $module === 'tasks') {
            $taskQuery = \App\Models\Task::query();
            if ($isBulkIds) {
                $taskQuery->whereIn('id', $targetIds);
            } else {
                $taskQuery->whereBetween('created_at', [$start, $end]);
            }
            $companyScope($taskQuery);
            $deletedCounts['tasks'] = $taskQuery->delete();
        }

        // 9. Payroll Batches & Salaries
        if ($module === 'all' || $module === 'payroll') {
            if ($isBulkIds) {
                // Support deleting individual salaries
                $salaryQuery = \App\Models\Salary::query()->whereIn('id', $targetIds);
                $companyScope($salaryQuery);
                $deletedSalaries = $salaryQuery->delete();
                $deletedCounts['payroll_batches'] = $deletedSalaries;

                // Also support deleting batches if batch IDs were supplied
                $batchQuery = \App\Models\PayrollBatch::query()->whereIn('id', $targetIds);
                $companyScope($batchQuery);
                $batches = $batchQuery->get();
                foreach ($batches as $b) {
                    \App\Models\Salary::where('batch_id', $b->id)->delete();
                    $b->delete();
                }
            } else {
                $batchQuery = \App\Models\PayrollBatch::query();
                $batchQuery->whereBetween('created_at', [$start, $end]);
                $companyScope($batchQuery);
                $batches = $batchQuery->get();
                foreach ($batches as $batch) {
                    \App\Models\Salary::where('batch_id', $batch->id)->delete();
                    $batch->delete();
                }
                $deletedCounts['payroll_batches'] = $batches->count();

                // Also purge any orphan salaries in that range
                $orphanSalaryQuery = \App\Models\Salary::query()->whereBetween('created_at', [$start, $end]);
                $companyScope($orphanSalaryQuery);
                $orphanSalaryQuery->delete();
            }
        }

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

        // Audit log via callback
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
