<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class RequestHistoryService
{
    private const TYPE_FETCHERS = [
        'leave' => 'fetchHistoryLeaves',
        'permit' => 'fetchHistoryPermits',
        'overtime' => 'fetchHistoryOvertimes',
        'reimbursement' => 'fetchHistoryReimbursements',
        'fund_request' => 'fetchHistoryFundRequests',
        'attendance_correction' => 'fetchHistoryCorrections',
        'dinas_luar' => 'fetchHistoryDinasLuar',
    ];

    public static function getHistoryRequests(Request $request, User $user)
    {
        $companyScope = self::buildCompanyScope($user);
        $type = $request->input('type', 'all');
        $status = $request->input('status', 'all');

        $historyItems = self::collectHistoryItems($type, $status, $request, $companyScope);

        return $historyItems->sortByDesc('created_at')->values()->take(100);
    }

    private static function buildCompanyScope(User $user): \Closure
    {
        $isGlobalAdmin = $user->isSuperAdmin() || $user->canAccessAllCompanies();
        $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);

        return function ($query) use ($user, $isGlobalAdmin, $subordinateIds) {
            if ($isGlobalAdmin) {
                return;
            }
            if ($user->company_id) {
                $query->where('company_id', $user->company_id);
            }
            if (! empty($subordinateIds)) {
                $query->whereIn('user_id', $subordinateIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        };
    }

    private static function collectHistoryItems(string $type, string $status, Request $request, \Closure $companyScope): \Illuminate\Support\Collection
    {
        $historyItems = collect();

        foreach (self::TYPE_FETCHERS as $key => $method) {
            if ($type === 'all' || $type === $key) {
                $historyItems = $historyItems->concat(self::$method($companyScope, $status, $request));
            }
        }

        if (in_array($status, ['all', 'edited', 'deleted'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryLogs($companyScope, $status, $request));
        }

        return $historyItems;
    }

    private static function applyDateFilter($query, Request $request, string $dateColumn = 'updated_at')
    {
        $period = $request->input('period');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $month = $request->input('month');

        if ($startDate && $endDate) {
            $query->whereBetween($dateColumn, [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay(),
            ]);

            return;
        }

        if ($period === 'this_month') {
            $query->whereBetween($dateColumn, [
                Carbon::now()->startOfMonth(),
                Carbon::now()->endOfMonth(),
            ]);
        } elseif ($period === 'this_year') {
            $query->whereBetween($dateColumn, [
                Carbon::now()->startOfYear(),
                Carbon::now()->endOfYear(),
            ]);
        } elseif ($period === 'last_month') {
            $query->whereBetween($dateColumn, [
                Carbon::now()->subMonth()->startOfMonth(),
                Carbon::now()->subMonth()->endOfMonth(),
            ]);
        } elseif ($month) {
            $query->where($dateColumn, 'like', "{$month}%");
        }
    }

    private static function fetchHistoryLeaves(\Closure $companyScope, string $status, Request $request)
    {
        $q = Leave::with(['user', 'supervisorApprover', 'hrApprover'])->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'leave-'.$item->id,
                'record_id' => $item->id,
                'type' => 'leave',
                'category' => 'Cuti',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "{$item->type} ({$item->start_date} s/d {$item->end_date})".($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => $item->hrApprover?->name ?? $item->supervisorApprover?->name ?? 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryPermits(\Closure $companyScope, string $status, Request $request)
    {
        $q = Permit::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'permit-'.$item->id,
                'record_id' => $item->id,
                'type' => 'permit',
                'category' => 'Izin',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "{$item->type} ({$item->start_date})".($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryOvertimes(\Closure $companyScope, string $status, Request $request)
    {
        $q = Overtime::with(['user', 'approver'])->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'overtime-'.$item->id,
                'record_id' => $item->id,
                'type' => 'overtime',
                'category' => 'Lembur',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => ($item->title ?? 'Lembur').($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => $item->approver?->name ?? 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryReimbursements(\Closure $companyScope, string $status, Request $request)
    {
        $q = Reimbursement::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'reimbursement-'.$item->id,
                'record_id' => $item->id,
                'type' => 'reimbursement',
                'category' => 'Reimbursement',
                'user_name' => $item->employee_name ?? $item->user?->name ?? 'Karyawan',
                'description' => "{$item->title} (Rp ".number_format($item->amount, 0, ',', '.').')',
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryFundRequests(\Closure $companyScope, string $status, Request $request)
    {
        $q = FundRequest::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'fund-'.$item->id,
                'record_id' => $item->id,
                'type' => 'fund_request',
                'category' => 'Pengajuan Dana',
                'user_name' => $item->employee_name ?? $item->user?->name ?? 'Karyawan',
                'description' => "{$item->title} (Rp ".number_format($item->amount, 0, ',', '.').')',
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->reject_reason,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryCorrections(\Closure $companyScope, string $status, Request $request)
    {
        $q = AttendanceCorrection::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'correction-'.$item->id,
                'record_id' => $item->id,
                'type' => 'attendance_correction',
                'category' => 'Koreksi Absen',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "Koreksi {$item->correction_type}: {$item->reason}",
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }

    private static function fetchHistoryLogs(\Closure $companyScope, string $status, Request $request)
    {
        $logQuery = ActivityLog::with('user')
            ->whereIn('module', ['leaves', 'permits', 'overtimes', 'reimbursements', 'fund_requests', 'attendance_corrections', 'maintenance'])
            ->where(function ($q) {
                $q->where('action', 'like', 'UPDATE_%')
                    ->orWhere('action', 'like', 'DELETE_%')
                    ->orWhere('action', 'like', 'PURGE_%');
            });

        $companyScope($logQuery);
        self::applyDateFilter($logQuery, $request, 'created_at');

        if ($status === 'edited') {
            $logQuery->where('action', 'like', 'UPDATE_%');
        } elseif ($status === 'deleted') {
            $logQuery->where(function ($q) {
                $q->where('action', 'like', 'DELETE_%')->orWhere('action', 'like', 'PURGE_%');
            });
        }

        return $logQuery->orderBy('created_at', 'desc')->take(50)->get()->map(function ($log) {
            $isDelete = str_contains($log->action, 'DELETE') || str_contains($log->action, 'PURGE');

            return [
                'id' => 'log-'.$log->id,
                'record_id' => $log->id,
                'type' => $log->module ?? 'general',
                'category' => strtoupper(str_replace('_', ' ', $log->module ?? 'Log')),
                'user_name' => $log->user?->name ?? 'Sistem / Pengguna',
                'description' => $log->description,
                'status' => $isDelete ? 'deleted' : 'updated',
                'action_type' => $isDelete ? 'deleted' : 'updated',
                'actor_name' => $log->user?->name ?? 'User',
                'remark' => $log->ip_address ? "IP: {$log->ip_address}" : null,
                'created_at' => $log->created_at?->toISOString() ?? (string) $log->created_at,
                'updated_at' => $log->created_at?->toISOString() ?? (string) $log->created_at,
            ];
        });
    }

    private static function fetchHistoryDinasLuar(\Closure $companyScope, string $status, Request $request)
    {
        $q = Attendance::with(['user', 'spvApprover', 'hrApprover'])
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['approved_hr', 'approved_spv', 'rejected']);
        $companyScope($q);
        self::applyDateFilter($q, $request, 'updated_at');

        if ($status !== 'all') {
            if ($status === 'approved') {
                $q->whereIn('dinas_luar_status', ['approved_hr', 'approved_spv']);
            } elseif ($status === 'rejected') {
                $q->where('dinas_luar_status', 'rejected');
            }
        }

        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            $isApproved = in_array($item->dinas_luar_status, ['approved_hr', 'approved_spv']);

            return [
                'id' => 'dinas-'.$item->id,
                'record_id' => $item->id,
                'type' => 'dinas_luar',
                'category' => 'Dinas Luar',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "Tujuan: {$item->dinas_luar_destination}".($item->dinas_luar_notes ? " ({$item->dinas_luar_notes})" : ''),
                'status' => $isApproved ? 'approved' : 'rejected',
                'action_type' => 'processed',
                'actor_name' => $item->hrApprover?->name ?? $item->spvApprover?->name ?? 'Approver',
                'remark' => $item->rejection_reason ?? $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string) $item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string) $item->updated_at,
            ];
        });
    }
}
