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
use App\Models\User;
use App\Models\VehicleLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PendingRequestService
{
    public static function isExecutiveOrAdmin($user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
    }

    public static function applyDateFilter($query, ?Request $request = null, string $dateColumn = 'created_at')
    {
        if (! $request) {
            return;
        }

        $period = $request->input('period');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

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
        }
    }

    public static function getPendingCount(User $user, array $permMap, ?Request $request = null): array
    {
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
        $isCompanyAdmin = self::isExecutiveOrAdmin($user);
        $hasSubordinates = User::where('supervisor_id', $user->id)->exists();
        $hasPrivilegedAccess = $isGlobalAdmin;

        $canApprove = fn (string $type): bool => self::canUserApprovePendingType($user, $type, $permMap, $hasPrivilegedAccess, $hasSubordinates);
        $fundRequestStatus = ($isGlobalAdmin || $isCompanyAdmin) ? ['pending', 'approved_by_supervisor'] : 'pending';

        $leaveCount = $canApprove('leave') ? self::countScopedPending(Leave::class, 'leave', ['pending', 'pending_supervisor', 'pending_hr'], $user, $isGlobalAdmin, $request) : 0;
        $overtimeCount = $canApprove('overtime') ? self::countScopedPending(Overtime::class, 'overtime', 'pending', $user, $isGlobalAdmin, $request) : 0;
        $reimbursementCount = $canApprove('reimbursement') ? self::countScopedPending(Reimbursement::class, 'reimbursement', 'pending', $user, $isGlobalAdmin, $request) : 0;
        $permitCount = $canApprove('permit') ? self::countScopedPending(Permit::class, 'permit', 'pending', $user, $isGlobalAdmin, $request) : 0;
        $vehicleCount = $canApprove('vehicle_log') ? self::countScopedPending(VehicleLog::class, 'vehicle_log', ['pending', 'completed'], $user, $isGlobalAdmin, $request) : 0;
        $fundRequestCount = $canApprove('fund_request') ? self::countScopedPending(FundRequest::class, 'fund_request', $fundRequestStatus, $user, $isGlobalAdmin, $request) : 0;
        $payrollCount = $canApprove('payroll') ? self::countScopedPending(PayrollBatch::class, 'payroll', 'pending_approval', $user, $isGlobalAdmin, $request) : 0;

        $earlyOutCount = $canApprove('early_out')
            ? self::countDirectAttendancePending(Attendance::class, ['is_early_out' => true, 'early_out_status' => 'pending'], $user, $isGlobalAdmin, $request)
            : 0;

        $correctionCount = $canApprove('attendance_correction')
            ? self::countDirectAttendancePending(AttendanceCorrection::class, ['status' => 'pending'], $user, $isGlobalAdmin, $request)
            : 0;

        $dinasLuarCount = $canApprove('dinas_luar')
            ? self::countDirectAttendancePending(Attendance::class, ['attendance_type' => 'dinas_luar'], $user, $isGlobalAdmin, $request, ['dinas_luar_status' => ['pending', 'waiting_approval', 'approved_spv']])
            : 0;

        return [
            'leave' => $leaveCount,
            'overtime' => $overtimeCount,
            'reimbursement' => $reimbursementCount,
            'permit' => $permitCount,
            'fund_request' => $fundRequestCount,
            'vehicle_log' => $vehicleCount,
            'payroll' => $payrollCount,
            'early_out' => $earlyOutCount,
            'attendance_correction' => $correctionCount,
            'dinas_luar' => $dinasLuarCount,
            'total' => $leaveCount + $overtimeCount + $reimbursementCount + $permitCount + $vehicleCount + $fundRequestCount + $payrollCount + $earlyOutCount + $correctionCount + $dinasLuarCount,
        ];
    }

    private static function canUserApprovePendingType(User $user, string $type, array $permMap, bool $hasPrivilegedAccess, bool $hasSubordinates = false): bool
    {
        if ($hasPrivilegedAccess) {
            return true;
        }

        if (! $hasSubordinates) {
            return false;
        }

        return isset($permMap[$type]) && $user->hasPermission($permMap[$type]);
    }

    private static function countDirectAttendancePending(string $modelClass, array $whereConditions, User $user, bool $isGlobalAdmin, ?Request $request, array $whereInConditions = []): int
    {
        $query = $modelClass::where($whereConditions);
        foreach ($whereInConditions as $col => $vals) {
            $query->whereIn($col, $vals);
        }
        if (! $isGlobalAdmin) {
            $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
            if (empty($subordinateIds)) {
                return 0;
            }
            $query->whereIn('user_id', $subordinateIds);
            if ($user->company_id) {
                $query->where('company_id', $user->company_id);
            }
        } elseif ($request && $request->filled('company_id') && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }
        self::applyDateFilter($query, $request);

        return $query->count();
    }

    public static function getPendingRequests(Request $request, User $user, array $permMap)
    {
        $type = (string) $request->type;

        if (! self::canUserViewPendingType($user, $type, $permMap)) {
            return [];
        }

        $isGlobalAdmin = $user->isSuperAdmin() || $user->canAccessAllCompanies();
        $isCompanyAdmin = self::isExecutiveOrAdmin($user);

        $query = self::resolvePendingBaseQuery($type, $isGlobalAdmin, $isCompanyAdmin);
        if (! $query) {
            return null;
        }

        if (! $isGlobalAdmin && $user->company_id) {
            $query->where('company_id', $user->company_id);
        } elseif ($request->filled('company_id') && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }

        // Apply period or start_date/end_date filter
        self::applyDateFilter($query, $request);

        $items = $query->orderBy('created_at', 'desc')->get();

        if (! $isGlobalAdmin) {
            $items = self::filterPendingItems($items, $type, $user);
        }

        self::attachStepInfo($items, $type, $user);

        return $items;
    }

    private static function canUserViewPendingType(User $user, ?string $type, array $permMap): bool
    {
        $isGlobalAdmin = $user->isSuperAdmin()
            || $user->role_id === 1
            || $user->canAccessAllCompanies();

        if ($isGlobalAdmin) {
            return true;
        }

        // Non-SuperAdmin must have subordinates to access manager approvals
        $hasSubordinates = User::where('supervisor_id', $user->id)->exists();
        if (! $hasSubordinates) {
            return false;
        }

        return ! isset($permMap[$type]) || $user->hasPermission($permMap[$type]);
    }

    private static function attachStepInfo($items, string $type, User $user): void
    {
        $items->each(function ($item) use ($type, $user) {
            if (empty($item->current_approval_step)) {
                return;
            }

            $submitter = $item->user ?: $user;
            if ($type === 'payroll') {
                $submitter = $item->creator ?: $user;
            }

            $companyId = $item->company_id ?? $user->company_id;
            if (! empty($companyId)) {
                $item->current_step_info = ApprovalService::getCurrentStepInfo(
                    $type,
                    (int) $companyId,
                    (int) $item->current_approval_step,
                    $submitter
                );
            }
        });
    }

    private static function countScopedPending($modelClass, string $type, string|array $pendingStatus, User $user, bool $isGlobalAdmin, ?Request $request = null): int
    {
        $query = is_array($pendingStatus)
            ? $modelClass::whereIn('status', $pendingStatus)
            : $modelClass::where('status', $pendingStatus);

        if ($request && $request->filled('company_id') && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        } elseif (! $isGlobalAdmin && $user->company_id) {
            $query->where('company_id', $user->company_id);
        }

        if ($type === 'overtime') {
            $query->whereNull('assigned_by');
        }

        self::applyDateFilter($query, $request);

        if (! $isGlobalAdmin) {
            $withRelations = ($type === 'payroll')
                ? ['creator.supervisor', 'creator.role']
                : ['user.supervisor', 'user.role'];
            $items = $query->with($withRelations)->get();

            return self::filterPendingItems($items, $type, $user)->count();
        }

        return $query->count();
    }

    private static function resolvePendingBaseQuery(string $type, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        return match ($type) {
            'leave' => Leave::with(['user.role', 'user.office', 'user.supervisor'])->whereIn('status', ['pending', 'pending_supervisor', 'pending_hr']),
            'overtime' => Overtime::with(['user.role', 'user.office', 'user.supervisor', 'items'])->where('status', 'pending')->whereNull('assigned_by'),
            'reimbursement' => Reimbursement::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'permit' => Permit::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with(['user.role', 'user.office', 'user.supervisor', 'vehicle'])->whereIn('status', ['pending', 'completed']),
            'payroll' => PayrollBatch::with(['creator'])->where('status', 'pending_approval'),
            'early_out' => Attendance::with(['user.role', 'user.office', 'user.supervisor'])->where('is_early_out', true)->where('early_out_status', 'pending'),
            'attendance_correction' => AttendanceCorrection::with(['user.role', 'user.office', 'user.supervisor', 'attendance'])->where('status', 'pending'),
            'dinas_luar' => Attendance::with(['user.role', 'user.office', 'user.supervisor'])->where('attendance_type', 'dinas_luar')->whereIn('dinas_luar_status', ['pending', 'waiting_approval', 'approved_spv']),
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
        return $items->filter(fn ($item) => self::canUserAccessPendingItem($item, $type, $user))->values();
    }

    private static function canUserAccessPendingItem($item, string $type, User $user): bool
    {
        if ($user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies()) {
            return true;
        }

        $submitter = $item->user;
        if ($type === 'payroll') {
            $submitter = $item->creator ?: $user;
        }
        $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
        $submitterId = $item->user_id ?? $item->user?->id ?? ($type === 'payroll' ? $item->created_by : null);
        $isSubordinate = $submitterId && in_array($submitterId, $subordinateIds);

        if (! empty($item->current_approval_step) && $submitter) {
            return self::canAccessWorkflowPendingItem($item, $type, $user, $submitter, $isSubordinate);
        }

        return ($type === 'payroll')
            ? ($user->hasPermission('approve-payroll') && $isSubordinate)
            : self::canHandlePendingItem($item, $user, $type);
    }

    private static function canAccessWorkflowPendingItem($item, string $type, User $user, $submitter, bool $isSubordinate): bool
    {
        $canApproveWorkflow = ApprovalService::canApprove(
            $type,
            $item->company_id ?? $user->company_id,
            $user,
            $submitter,
            $item->current_approval_step
        );

        if (! $canApproveWorkflow) {
            return false;
        }

        // If workflow step specifically designates this user by ID, grant access
        $workflow = ApprovalService::getWorkflow($type, $item->company_id ?? $user->company_id, $submitter);
        $step = $workflow?->steps()->where('step_number', $item->current_approval_step)->first();
        if ($step && $step->approver_type === 'user' && $step->approver_user_id === $user->id) {
            return true;
        }

        // Otherwise, non-superadmin must be the atasan (subordinate tree)
        return $isSubordinate;
    }

    private static function canHandlePendingItem($item, User $user, string $type = ''): bool
    {
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
        if ($isGlobalAdmin) {
            return true;
        }

        $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
        $submitterId = $item->user_id ?? $item->user?->id ?? ($type === 'payroll' ? $item->created_by : null);

        // Jika bukan Super Admin, pengajuan WAJIB diajukan oleh bawahan (langsung maupun berjenjang)
        if (! $submitterId || ! in_array($submitterId, $subordinateIds)) {
            return false;
        }

        return match ($type) {
            'fund_request' => self::canHandleFundRequest($item, $user, false, true),
            'reimbursement' => true,
            'overtime' => true,
            'attendance_correction' => true,
            'vehicle_log' => true,
            'early_out' => true,
            'dinas_luar' => true,
            default => self::canHandleDefaultPending($item, false, true, $user),
        };
    }

    private static function canHandleFundRequest($item, User $user, bool $isAdmin, bool $isSupervisor): bool
    {
        if ($isAdmin || $user->hasPermission('approve-fund-requests')) {
            return true;
        }

        return $item->status === 'pending' && $isSupervisor;
    }

    private static function canHandleDefaultPending($item, bool $isAdmin, bool $isSupervisor, User $user): bool
    {
        if ($item->status === 'pending_hr') {
            return $isAdmin || $user->hasPermission('approve-leaves') || $user->hasPermission('approve-permits');
        }

        if ($item->status === 'pending_supervisor' || $item->status === 'pending') {
            return $isSupervisor || $isAdmin;
        }

        return false;
    }
}
