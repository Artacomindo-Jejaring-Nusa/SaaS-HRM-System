<?php

namespace App\Services;

use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PayrollBatch;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use App\Models\VehicleLog;
use Illuminate\Http\Request;

class PendingRequestService
{
    public static function isExecutiveOrAdmin($user): bool
    {
        $roleName = strtolower($user->role?->name ?? '');
        return $user->role_id === 1
            || $user->is_manager
            || $user->hasPermission('approve-leaves')
            || $user->hasPermission('approve-permits')
            || $user->hasPermission('approve-overtimes')
            || $user->hasPermission('approve-reimbursements')
            || $user->hasPermission('approve-fund-requests')
            || $user->hasPermission('approve-vehicle-logs')
            || $user->hasPermission('approve-payroll')
            || $user->hasPermission('approve-shift-swaps')
            || $user->hasPermission('approve-project-costs')
            || $user->hasPermission('view-manager-portal')
            || str_contains($roleName, 'admin')
            || str_contains($roleName, 'hrd')
            || str_contains($roleName, 'hr')
            || str_contains($roleName, 'direktur')
            || str_contains($roleName, 'director')
            || str_contains($roleName, 'coo')
            || str_contains($roleName, 'ceo')
            || str_contains($roleName, 'boc')
            || str_contains($roleName, 'management')
            || str_contains($roleName, 'supervisor')
            || str_contains($roleName, 'manager')
            || str_contains($roleName, 'kadiv')
            || str_contains($roleName, 'lead');
    }

    public static function getPendingCount(User $user, array $permMap): array
    {
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = self::isExecutiveOrAdmin($user);

        $canApprove = function ($t) use ($user, $isGlobalAdmin, $permMap) {
            if ($isGlobalAdmin || $user->hasPermission('manage-approvals')) {
                return true;
            }
            return isset($permMap[$t]) && $user->hasPermission($permMap[$t]);
        };

        $fundRequestStatus = ($isGlobalAdmin || $isCompanyAdmin) ? ['pending', 'approved_by_supervisor'] : 'pending';

        $leaveCount = $canApprove('leave') ? self::countScopedPending(Leave::class, 'leave', 'pending', $user, $isGlobalAdmin) : 0;
        $overtimeCount = $canApprove('overtime') ? self::countScopedPending(Overtime::class, 'overtime', 'pending', $user, $isGlobalAdmin) : 0;
        $reimbursementCount = $canApprove('reimbursement') ? self::countScopedPending(Reimbursement::class, 'reimbursement', 'pending', $user, $isGlobalAdmin) : 0;
        $permitCount = $canApprove('permit') ? self::countScopedPending(Permit::class, 'permit', 'pending', $user, $isGlobalAdmin) : 0;
        $vehicleCount = $canApprove('vehicle_log') ? self::countScopedPending(VehicleLog::class, 'vehicle_log', ['pending', 'completed'], $user, $isGlobalAdmin) : 0;
        $fundRequestCount = $canApprove('fund_request') ? self::countScopedPending(FundRequest::class, 'fund_request', $fundRequestStatus, $user, $isGlobalAdmin) : 0;
        $payrollCount = $canApprove('payroll') ? self::countScopedPending(PayrollBatch::class, 'payroll', 'pending_approval', $user, $isGlobalAdmin) : 0;

        return [
            'leave' => $leaveCount,
            'overtime' => $overtimeCount,
            'reimbursement' => $reimbursementCount,
            'permit' => $permitCount,
            'fund_request' => $fundRequestCount,
            'vehicle_log' => $vehicleCount,
            'payroll' => $payrollCount,
            'total' => $leaveCount + $overtimeCount + $reimbursementCount + $permitCount + $vehicleCount + $fundRequestCount + $payrollCount,
        ];
    }

    public static function getPendingRequests(Request $request, User $user, array $permMap)
    {
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = self::isExecutiveOrAdmin($user);
        $type = $request->type;

        if (!$isGlobalAdmin && !$user->hasPermission('manage-approvals') && isset($permMap[$type]) && !$user->hasPermission($permMap[$type])) {
            return [];
        }

        $query = self::resolvePendingBaseQuery((string)$type, $isGlobalAdmin, $isCompanyAdmin);
        if (!$query) {
            return null;
        }

        if (!$isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        if (!$isGlobalAdmin && !in_array($type, ['vehicle_log', 'payroll'])) {
            $items = self::filterPendingItems($items, (string)$type, $user);
        }

        $items->each(function ($item) use ($type, $user) {
            if (!empty($item->current_approval_step)) {
                $item->current_step_info = ApprovalService::getCurrentStepInfo(
                    $type,
                    $item->company_id ?? $user->company_id,
                    $item->current_approval_step
                );
            }
        });

        return $items;
    }

    private static function countScopedPending($modelClass, string $type, string|array $pendingStatus, User $user, bool $isGlobalAdmin): int
    {
        $query = is_array($pendingStatus)
            ? $modelClass::whereIn('status', $pendingStatus)
            : $modelClass::where('status', $pendingStatus);

        if (!$isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        if (!$isGlobalAdmin && !in_array($type, ['vehicle_log', 'payroll'])) {
            $items = $query->with(['user.supervisor', 'user.role'])->get();
            return self::filterPendingItems($items, $type, $user)->count();
        }

        return $query->count();
    }

    private static function resolvePendingBaseQuery(string $type, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        return match ($type) {
            'leave' => Leave::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'overtime' => Overtime::with(['user.role', 'user.office', 'user.supervisor', 'items'])->where('status', 'pending'),
            'reimbursement' => Reimbursement::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'permit' => Permit::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with(['user.role', 'user.office', 'user.supervisor', 'vehicle'])->whereIn('status', ['pending', 'completed']),
            'payroll' => PayrollBatch::with(['creator'])->where('status', 'pending_approval'),
            'fund_request' => FundRequest::with(['user.role', 'user.office', 'user.supervisor', 'supervisor', 'hrd'])->where(function ($q) use ($isGlobalAdmin, $isCompanyAdmin) {
                if ($isGlobalAdmin || $isCompanyAdmin) {
                    $q->whereIn('status', ['pending', 'approved_by_supervisor']);
                } else {
                    $q->where('status', 'pending');
                }
            }),
            default => null,
        };
    }

    private static function filterPendingItems($items, string $type, User $user)
    {
        return $items->filter(function ($item) use ($type, $user) {
            if (!empty($item->current_approval_step) && $item->user) {
                return ApprovalService::canApprove(
                    $type,
                    $item->company_id ?? $user->company_id,
                    $user,
                    $item->user,
                    $item->current_approval_step
                );
            }

            return self::canHandlePendingItem($item, $user);
        })->values();
    }

    private static function canHandlePendingItem($item, User $user): bool
    {
        if ($item->status === 'pending_hr') {
            return $user->hasPermission('approve-leaves') || $user->hasPermission('approve-permits') || $user->role_id === 1;
        }

        $isSupervisor = $item->status === 'pending_supervisor' || ($user->supervisor_id && $item->user_id);
        return $isSupervisor && $item->user?->supervisor_id === $user->id;
    }
}
