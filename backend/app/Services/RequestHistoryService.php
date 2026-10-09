<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\AttendanceCorrection;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Http\Request;

class RequestHistoryService
{
    public static function getHistoryRequests(Request $request, User $user)
    {
        $isGlobalAdmin = $user->role_id === 1;

        $type = $request->input('type', 'all');
        $status = $request->input('status', 'all');
        $month = $request->input('month');

        $companyScope = function ($query) use ($user, $isGlobalAdmin) {
            if (!$isGlobalAdmin && $user->company_id) {
                $query->where('company_id', $user->company_id);
            }
        };

        $historyItems = collect();

        if (in_array($type, ['all', 'leave'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryLeaves($companyScope, $status, $month));
        }

        if (in_array($type, ['all', 'permit'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryPermits($companyScope, $status, $month));
        }

        if (in_array($type, ['all', 'overtime'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryOvertimes($companyScope, $status, $month));
        }

        if (in_array($type, ['all', 'reimbursement'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryReimbursements($companyScope, $status, $month));
        }

        if (in_array($type, ['all', 'fund_request'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryFundRequests($companyScope, $status, $month));
        }

        if (in_array($type, ['all', 'attendance_correction'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryCorrections($companyScope, $status, $month));
        }

        if (in_array($status, ['all', 'edited', 'deleted'])) {
            $historyItems = $historyItems->concat(self::fetchHistoryLogs($companyScope, $status, $month));
        }

        return $historyItems->sortByDesc('created_at')->values()->take(100);
    }

    private static function fetchHistoryLeaves(\Closure $companyScope, string $status, ?string $month)
    {
        $q = Leave::with(['user', 'supervisorApprover', 'hrApprover'])->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('start_date', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'leave-' . $item->id,
                'record_id' => $item->id,
                'type' => 'leave',
                'category' => 'Cuti',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "{$item->type} ({$item->start_date} s/d {$item->end_date})" . ($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => $item->hrApprover?->name ?? $item->supervisorApprover?->name ?? 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryPermits(\Closure $companyScope, string $status, ?string $month)
    {
        $q = Permit::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('start_date', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'permit-' . $item->id,
                'record_id' => $item->id,
                'type' => 'permit',
                'category' => 'Izin',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "{$item->type} ({$item->start_date})" . ($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryOvertimes(\Closure $companyScope, string $status, ?string $month)
    {
        $q = Overtime::with(['user', 'approver'])->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('created_at', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'overtime-' . $item->id,
                'record_id' => $item->id,
                'type' => 'overtime',
                'category' => 'Lembur',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => ($item->title ?? 'Lembur') . ($item->reason ? ": {$item->reason}" : ''),
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => $item->approver?->name ?? 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryReimbursements(\Closure $companyScope, string $status, ?string $month)
    {
        $q = Reimbursement::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('created_at', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'reimbursement-' . $item->id,
                'record_id' => $item->id,
                'type' => 'reimbursement',
                'category' => 'Reimbursement',
                'user_name' => $item->employee_name ?? $item->user?->name ?? 'Karyawan',
                'description' => "{$item->title} (Rp " . number_format($item->amount, 0, ',', '.') . ")",
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryFundRequests(\Closure $companyScope, string $status, ?string $month)
    {
        $q = FundRequest::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('created_at', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'fund-' . $item->id,
                'record_id' => $item->id,
                'type' => 'fund_request',
                'category' => 'Pengajuan Dana',
                'user_name' => $item->employee_name ?? $item->user?->name ?? 'Karyawan',
                'description' => "{$item->title} (Rp " . number_format($item->amount, 0, ',', '.') . ")",
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->reject_reason,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryCorrections(\Closure $companyScope, string $status, ?string $month)
    {
        $q = AttendanceCorrection::with('user')->whereIn('status', ['approved', 'rejected']);
        $companyScope($q);
        if ($month) {
            $q->where('created_at', 'like', "{$month}%");
        }
        if ($status !== 'all' && in_array($status, ['approved', 'rejected'])) {
            $q->where('status', $status);
        }
        return $q->orderBy('updated_at', 'desc')->take(50)->get()->map(function ($item) {
            return [
                'id' => 'correction-' . $item->id,
                'record_id' => $item->id,
                'type' => 'attendance_correction',
                'category' => 'Koreksi Absen',
                'user_name' => $item->user?->name ?? 'Karyawan',
                'description' => "Koreksi {$item->correction_type}: {$item->reason}",
                'status' => $item->status,
                'action_type' => 'processed',
                'actor_name' => 'Approver',
                'remark' => $item->remark,
                'created_at' => $item->created_at?->toISOString() ?? (string)$item->created_at,
                'updated_at' => $item->updated_at?->toISOString() ?? (string)$item->updated_at,
            ];
        });
    }

    private static function fetchHistoryLogs(\Closure $companyScope, string $status, ?string $month)
    {
        $logQuery = ActivityLog::with('user')
            ->whereIn('module', ['leaves', 'permits', 'overtimes', 'reimbursements', 'fund_requests', 'attendance_corrections', 'maintenance'])
            ->where(function ($q) {
                $q->where('action', 'like', 'UPDATE_%')
                  ->orWhere('action', 'like', 'DELETE_%')
                  ->orWhere('action', 'like', 'PURGE_%');
            });

        $companyScope($logQuery);
        if ($month) {
            $logQuery->where('created_at', 'like', "{$month}%");
        }
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
                'id' => 'log-' . $log->id,
                'record_id' => $log->id,
                'type' => $log->module ?? 'general',
                'category' => strtoupper(str_replace('_', ' ', $log->module ?? 'Log')),
                'user_name' => $log->user?->name ?? 'Sistem / Pengguna',
                'description' => $log->description,
                'status' => $isDelete ? 'deleted' : 'updated',
                'action_type' => $isDelete ? 'deleted' : 'updated',
                'actor_name' => $log->user?->name ?? 'User',
                'remark' => $log->ip_address ? "IP: {$log->ip_address}" : null,
                'created_at' => $log->created_at?->toISOString() ?? (string)$log->created_at,
                'updated_at' => $log->created_at?->toISOString() ?? (string)$log->created_at,
            ];
        });
    }
}
