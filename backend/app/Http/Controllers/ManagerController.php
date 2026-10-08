<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PayrollBatch;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\Salary;
use App\Models\User;
use App\Models\VehicleLog;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ManagerController extends Controller
{
    use Notifiable;

    private const ROUTE_FUND_REQUESTS = '/dashboard/fund-requests';

    private const PERM_MAP = [
        'leave' => 'approve-leaves',
        'overtime' => 'approve-overtimes',
        'reimbursement' => 'approve-reimbursements',
        'permit' => 'approve-permits',
        'vehicle_log' => 'approve-vehicle-logs',
        'fund_request' => 'approve-fund-requests',
        'payroll' => 'approve-payroll',
    ];

    /**
     * Check if user is an executive, HR, or admin
     */
    private function isExecutiveOrAdmin($user): bool
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

    private const TYPE_TEXTS = [
        'leave' => 'Cuti',
        'overtime' => 'Lembur',
        'reimbursement' => 'Reimbursement',
        'permit' => 'Izin',
        'fund_request' => 'Pengajuan Dana',
        'vehicle_log' => 'Peminjaman Kendaraan',
        'payroll' => 'Payroll',
    ];

    private const ROUTE_PATHS = [
        'leave' => '/dashboard/leaves',
        'overtime' => '/dashboard/overtimes',
        'reimbursement' => '/dashboard/reimbursements',
        'permit' => '/dashboard/permits',
        'fund_request' => self::ROUTE_FUND_REQUESTS,
        'vehicle_log' => '/dashboard/fleet-logs',
        'payroll' => '/dashboard/payroll/approval',
    ];

    private function countScopedPending($modelClass, string $type, string|array $pendingStatus, $user, bool $isGlobalAdmin): int
    {
        $query = is_array($pendingStatus)
            ? $modelClass::whereIn('status', $pendingStatus)
            : $modelClass::where('status', $pendingStatus);

        if (!$isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        if (!$isGlobalAdmin && !in_array($type, ['vehicle_log', 'payroll'])) {
            $items = $query->with(['user.supervisor', 'user.role'])->get();
            return $this->filterPendingItems($items, $type, $user)->count();
        }

        return $query->count();
    }

    /**
     * Get summary count for pending requests
     */
    public function getPendingCount()
    {
        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        $canApprove = function ($t) use ($user, $isGlobalAdmin) {
            if ($isGlobalAdmin || $user->hasPermission('manage-approvals')) {
                return true;
            }
            return isset(self::PERM_MAP[$t]) && $user->hasPermission(self::PERM_MAP[$t]);
        };

        $fundRequestStatus = ($isGlobalAdmin || $isCompanyAdmin) ? ['pending', 'approved_by_supervisor'] : 'pending';

        $leaveCount = $canApprove('leave') ? $this->countScopedPending(Leave::class, 'leave', 'pending', $user, $isGlobalAdmin) : 0;
        $overtimeCount = $canApprove('overtime') ? $this->countScopedPending(Overtime::class, 'overtime', 'pending', $user, $isGlobalAdmin) : 0;
        $reimbursementCount = $canApprove('reimbursement') ? $this->countScopedPending(Reimbursement::class, 'reimbursement', 'pending', $user, $isGlobalAdmin) : 0;
        $permitCount = $canApprove('permit') ? $this->countScopedPending(Permit::class, 'permit', 'pending', $user, $isGlobalAdmin) : 0;
        $vehicleCount = $canApprove('vehicle_log') ? $this->countScopedPending(VehicleLog::class, 'vehicle_log', ['pending', 'completed'], $user, $isGlobalAdmin) : 0;
        $fundRequestCount = $canApprove('fund_request') ? $this->countScopedPending(FundRequest::class, 'fund_request', $fundRequestStatus, $user, $isGlobalAdmin) : 0;
        $payrollCount = $canApprove('payroll') ? $this->countScopedPending(PayrollBatch::class, 'payroll', 'pending_approval', $user, $isGlobalAdmin) : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'leave' => $leaveCount,
                'overtime' => $overtimeCount,
                'reimbursement' => $reimbursementCount,
                'permit' => $permitCount,
                'fund_request' => $fundRequestCount,
                'vehicle_log' => $vehicleCount,
                'payroll' => $payrollCount,
                'total' => $leaveCount + $overtimeCount + $reimbursementCount + $permitCount + $vehicleCount + $fundRequestCount + $payrollCount,
            ],
        ]);
    }

    private function resolvePendingBaseQuery(string $type, bool $isGlobalAdmin, bool $isCompanyAdmin)
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

    private function filterPendingItems($items, string $type, $user)
    {
        return $items->filter(function ($item) use ($type, $user) {
            if (!empty($item->current_approval_step) && $item->user) {
                return \App\Services\ApprovalService::canApprove(
                    $type,
                    $item->company_id ?? $user->company_id,
                    $user,
                    $item->user,
                    $item->current_approval_step
                );
            }

            return $this->canHandlePendingItem($item, $user);
        })->values();
    }

    private function canHandlePendingItem($item, $user): bool
    {
        if ($item->status === 'pending_hr') {
            return $user->hasPermission('approve-leaves') || $user->hasPermission('approve-permits') || $user->role_id === 1;
        }

        $isSupervisor = $item->status === 'pending_supervisor' || ($user->supervisor_id && $item->user_id);
        return $isSupervisor && $item->user?->supervisor_id === $user->id;
    }

    /**
     * Get list of pending requests by type
     */
    public function getPendingRequests(Request $request)
    {
        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);
        $type = $request->type;

        if (!$isGlobalAdmin && !$user->hasPermission('manage-approvals') && isset(self::PERM_MAP[$type]) && !$user->hasPermission(self::PERM_MAP[$type])) {
            return response()->json([
                'status' => 'success',
                'data' => [],
            ]);
        }

        $query = $this->resolvePendingBaseQuery((string)$type, $isGlobalAdmin, $isCompanyAdmin);
        if (!$query) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        if (!$isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        if (!$isGlobalAdmin && !in_array($type, ['vehicle_log', 'payroll'])) {
            $items = $this->filterPendingItems($items, (string)$type, $user);
        }

        $items->each(function ($item) use ($type, $user) {
            if (!empty($item->current_approval_step)) {
                $item->current_step_info = \App\Services\ApprovalService::getCurrentStepInfo(
                    $type,
                    $item->company_id ?? $user->company_id,
                    $item->current_approval_step
                );
            }
        });

        return response()->json([
            'status' => 'success',
            'data' => $items,
        ]);
    }

    private function prepareDynamicUpdateData($item, Request $request, $user, array $result): array
    {
        $updateData = [
            'status' => $result['status'],
            'current_approval_step' => $result['current_approval_step'],
        ];

        if ($request->type === 'fund_request' && empty($item->supervisor_approved_at)) {
            $updateData['supervisor_id'] = $user->id;
            $updateData['supervisor_approved_at'] = now();
        }

        if ($result['is_final']) {
            if ($request->type === 'fund_request') {
                $updateData['hrd_id'] = $user->id;
                $updateData['hrd_approved_at'] = now();
            } else {
                $updateData['approved_by'] = $user->id;
            }
            $updateData['remark'] = $request->remark;
        }

        return $updateData;
    }

    private function sendDynamicApprovalNotifications($item, Request $request, $user, array $result, string $typeText, string $routePath): string
    {
        if ($result['is_final']) {
            $statusText = strtoupper($result['status'] === 'approved' ? 'DISETUJUI' : 'DITOLAK');
            if ($item->user) {
                $this->notify(
                    $item->user,
                    "PENGAJUAN {$typeText} {$statusText}",
                    "Pengajuan {$typeText} Anda telah {$statusText}.".($request->remark ? " Catatan: {$request->remark}" : ''),
                    $result['status'] === 'approved' ? 'success' : 'danger',
                    $routePath
                );
            }
            return "Pengajuan {$typeText} berhasil di-{$request->status} secara final.";
        }

        if (isset($result['approvers'])) {
            foreach ($result['approvers'] as $nextApprover) {
                $this->notify(
                    $nextApprover,
                    "PENGAJUAN BUTUH PERSETUJUAN",
                    "Pengajuan {$typeText} dari {$item->user?->name} telah disetujui pada tahap sebelumnya dan kini membutuhkan persetujuan Anda ({$result['step_label']}).",
                    'warning',
                    $routePath
                );
            }
        }
        if ($item->user) {
            $this->notify(
                $item->user,
                "PROGRESS PENGAJUAN {$typeText}",
                "Pengajuan {$typeText} Anda telah disetujui oleh {$user->name} dan berlanjut ke tahap berikutnya.",
                'info',
                $routePath
            );
        }
        return "Persetujuan tahap {$item->current_approval_step} berhasil. Menunggu tahap berikutnya.";
    }

    private function handleDynamicApproval($item, Request $request, $user)
    {
        $action = $request->status === 'approved' ? 'approve' : 'reject';
        $result = \App\Services\ApprovalService::processApproval(
            $request->type,
            $item->company_id ?? $user->company_id,
            $user,
            $item->user,
            $item->current_approval_step,
            $action
        );

        if ($result && isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 403);
        }

        if (!$result) {
            return response()->json(['status' => 'error', 'message' => 'Gagal memproses alur persetujuan.'], 400);
        }

        $updateData = $this->prepareDynamicUpdateData($item, $request, $user, $result);
        $item->update($updateData);

        if ($request->type === 'leave' && $result['is_final'] && $result['status'] === 'approved') {
            LeaveController::processLeaveApprovalDeduction();
        }

        $typeText = self::TYPE_TEXTS[$request->type] ?? ucfirst($request->type);
        $routePath = self::ROUTE_PATHS[$request->type] ?? '/dashboard';
        $msg = $this->sendDynamicApprovalNotifications($item, $request, $user, $result, $typeText, $routePath);

        return response()->json([
            'status' => 'success',
            'message' => $msg,
            'data' => $item,
        ]);
    }

    private function updateLegacyFundRequest($item, Request $request, $user, bool $isCompanyAdmin, bool $isGlobalAdmin): string
    {
        if ($request->status === 'approved') {
            if ($item->status === 'pending' && !$isCompanyAdmin && !$isGlobalAdmin) {
                $item->update([
                    'status' => 'approved_by_supervisor',
                    'supervisor_id' => $user->id,
                    'supervisor_approved_at' => now(),
                    'remark' => $request->remark,
                ]);

                $hrds = User::where('company_id', $user->company_id)
                    ->whereHas('role', function ($q) {
                        $q->where('name', 'HRD')->orWhere('name', 'HRD Manager')->orWhere('name', 'Admin');
                    })->get();

                foreach ($hrds as $hrd) {
                    $this->notify(
                        $hrd,
                        'PERSETUJUAN DANA (TAHAP HRD)',
                        "Pengajuan dana {$item->user?->name} telah disetujui Supervisor. Menunggu persetujuan akhir Anda.",
                        'warning',
                        self::ROUTE_FUND_REQUESTS
                    );
                }
                return 'approved_by_supervisor';
            }

            $item->update([
                'status' => 'approved',
                'hrd_id' => $user->id,
                'hrd_approved_at' => now(),
                'remark' => $request->remark,
            ]);
            return 'approved';
        }

        $item->update([
            'status' => 'rejected',
            'hrd_id' => $user->id,
            'rejected_at' => now(),
            'reject_reason' => $request->remark,
            'remark' => $request->remark,
        ]);
        return 'rejected';
    }

    private function handleLegacyApproval($item, Request $request, $user, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        $targetStatus = $request->status;
        if ($request->type === 'vehicle_log') {
            $isApproved = $request->status === 'approved';
            $targetStatus = ($item->status === 'pending')
                ? ($isApproved ? 'approved' : 'rejected')
                : ($isApproved ? 'validated' : 'rejected');
        }

        $previousStatus = $item->status;

        if ($request->type === 'fund_request') {
            $targetStatus = $this->updateLegacyFundRequest($item, $request, $user, $isCompanyAdmin, $isGlobalAdmin);
        } else {
            $item->update([
                'status' => $targetStatus,
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);
        }

        if ($request->type === 'leave') {
            if ($targetStatus === 'approved' && $previousStatus !== 'approved') {
                LeaveController::processLeaveApprovalDeduction();
            } elseif ($targetStatus === 'rejected' && $previousStatus === 'approved') {
                LeaveController::processLeaveApprovalRefund();
            }
        }

        $statusText = strtoupper($request->status === 'approved' ? 'DISETUJUI' : 'DITOLAK');
        $typeText = self::TYPE_TEXTS[$request->type] ?? ucfirst($request->type);
        $routePath = self::ROUTE_PATHS[$request->type] ?? '/dashboard';

        if ($item->user) {
            $this->notify(
                $item->user,
                "PENGAJUAN {$typeText} {$statusText}",
                "Pengajuan {$typeText} Anda telah {$statusText} oleh Manager/Admin.".($request->remark ? " Catatan: {$request->remark}" : ''),
                $request->status === 'approved' ? 'success' : 'danger',
                $routePath
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => "Pengajuan {$typeText} berhasil di-{$request->status}.",
            'data' => $item,
        ]);
    }

    /**
     * Approve or Reject a request
     */
    public function updateRequestStatus(Request $request)
    {
        $request->validate([
            'type' => 'required|in:leave,overtime,reimbursement,permit,vehicle_log,fund_request,payroll',
            'id' => 'required|integer',
            'status' => 'required|in:approved,rejected',
            'remark' => 'nullable|string',
        ]);

        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        // Only block users who have no manager/executive status, no subordinates, and no permission
        if (! $isGlobalAdmin && ! $isCompanyAdmin && $subordinateIds->isEmpty() && isset(self::PERM_MAP[$request->type]) && ! $user->hasPermission(self::PERM_MAP[$request->type])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menyetujui pengajuan ini.'
            ], 403);
        }

        if ($request->type === 'payroll') {
            return $this->handlePayrollApproval($request, $user, $isGlobalAdmin);
        }

        return $this->handleGeneralRequestApproval($request, $user, $isGlobalAdmin, $isCompanyAdmin);
    }

    private function handlePayrollApproval(Request $request, $user, bool $isGlobalAdmin)
    {
        $batch = PayrollBatch::where('id', $request->id)
            ->when(! $isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->firstOrFail();

        $isApproved = $request->status === 'approved';

        $batch->update([
            'status' => $request->status,
            'approved_by' => $isApproved ? $user->id : null,
            'approved_at' => $isApproved ? now() : null,
            'rejection_note' => $isApproved ? null : ($request->remark ?? 'Ditolak oleh atasan/approver'),
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => $request->status]);

        $message = $isApproved
            ? 'Batch payroll berhasil disetujui.'
            : 'Batch payroll berhasil ditolak untuk revisi.';

        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => $batch->fresh(),
        ]);
    }

    private function handleGeneralRequestApproval(Request $request, $user, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        $model = match ($request->type) {
            'leave' => Leave::class,
            'overtime' => Overtime::class,
            'reimbursement' => Reimbursement::class,
            'permit' => Permit::class,
            'vehicle_log' => VehicleLog::class,
            'fund_request' => FundRequest::class,
        };

        $query = $model::where('id', $request->id);
        if (! $isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        $item = $query->first();
        if (!$item) {
            return response()->json(['status' => 'error', 'message' => 'Pengajuan tidak ditemukan atau Anda tidak memiliki hak akses.'], 404);
        }

        return !empty($item->current_approval_step)
            ? $this->handleDynamicApproval($item, $request, $user)
            : $this->handleLegacyApproval($item, $request, $user, $isGlobalAdmin, $isCompanyAdmin);
    }

    /**
     * Get team attendance status for today
     */
    public function getTeamAttendance()
    {
        $user = Auth::user();
        $today = Carbon::today()->toDateString();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user) || $user->hasPermission('view-attendances');
        $directSubordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        $query = User::with(['role', 'attendances' => function ($q) use ($today) {
            $q->whereDate('check_in', $today);
        }]);

        if ($directSubordinateIds->isNotEmpty()) {
            $query->whereIn('id', $directSubordinateIds);
        } elseif ($isGlobalAdmin) {
            $query->where('id', '!=', $user->id)->take(50);
        } elseif ($isCompanyAdmin) {
            $query->where('company_id', $user->company_id)->where('id', '!=', $user->id)->take(50);
        } else {
            $query->where('supervisor_id', $user->id);
        }

        $teamAttendance = $query->get()->map(function ($sub) {
            $attendance = $sub->attendances->first();
            $status = $attendance ? ($attendance->check_out ? 'Selesai' : 'Hadir') : 'Belum Masuk';
            $locationLabel = $attendance ? ($attendance->attendance_type === 'dinas_luar' ? 'Dinas Luar' : 'Di Kantor') : null;

            return [
                'id' => $sub->id,
                'name' => $sub->name,
                'role' => $sub->role?->name ?? 'Karyawan',
                'photo_url' => $sub->profile_photo_url,
                'status' => $status,
                'check_in' => $attendance?->check_in ? Carbon::parse($attendance->check_in)->format('H:i') : null,
                'check_out' => $attendance?->check_out ? Carbon::parse($attendance->check_out)->format('H:i') : null,
                'attendance_type' => $attendance?->attendance_type ?? 'office',
                'is_dinas_luar' => $attendance?->attendance_type === 'dinas_luar',
                'dinas_luar_destination' => $attendance?->dinas_luar_destination,
                'dinas_luar_status' => $attendance?->dinas_luar_status,
                'location_label' => $locationLabel,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $teamAttendance,
        ]);
    }
}
