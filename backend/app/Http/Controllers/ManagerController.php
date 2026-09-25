<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\FundRequest;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
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

    private function getTypeText(string $type): string
    {
        return match ($type) {
            'leave' => 'Cuti',
            'overtime' => 'Lembur',
            'reimbursement' => 'Reimbursement',
            'permit' => 'Izin',
            'fund_request' => 'Pengajuan Dana',
            'vehicle_log' => 'Peminjaman Kendaraan',
            default => ucfirst($type),
        };
    }

    private function getRoutePath(string $type): string
    {
        return match ($type) {
            'leave' => '/dashboard/leaves',
            'overtime' => '/dashboard/overtimes',
            'reimbursement' => '/dashboard/reimbursements',
            'permit' => '/dashboard/permits',
            'fund_request' => self::ROUTE_FUND_REQUESTS,
            'vehicle_log' => '/dashboard/fleet-logs',
            default => '/dashboard',
        };
    }

    private function countScopedPending($modelClass, string $type, string|array $pendingStatus, $user, bool $isGlobalAdmin, bool $isCompanyAdmin, $subordinateIds): int
    {
        $query = is_array($pendingStatus)
            ? $modelClass::whereIn('status', $pendingStatus)
            : $modelClass::where('status', $pendingStatus);

        if (!$isGlobalAdmin) {
            if ($isCompanyAdmin) {
                $query->where(function ($q) use ($user, $subordinateIds) {
                    $q->where('company_id', $user->company_id);
                    if ($subordinateIds->isNotEmpty()) {
                        $q->orWhereIn('user_id', $subordinateIds);
                    }
                });
            } else {
                $query->whereIn('user_id', $subordinateIds);
            }
        }

        if (!$isGlobalAdmin && $type !== 'vehicle_log') {
            $items = $query->with('user')->get();
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
                return true;
            })->count();
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
        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        $canApprove = function ($t) use ($user, $isGlobalAdmin) {
            if ($isGlobalAdmin) {
                return true;
            }
            return isset(self::PERM_MAP[$t]) && $user->hasPermission(self::PERM_MAP[$t]);
        };

        $fundRequestStatus = ($isGlobalAdmin || $isCompanyAdmin) ? ['pending', 'approved_by_supervisor'] : 'pending';

        $leaveCount = $canApprove('leave') ? $this->countScopedPending(Leave::class, 'leave', 'pending', $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;
        $overtimeCount = $canApprove('overtime') ? $this->countScopedPending(Overtime::class, 'overtime', 'pending', $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;
        $reimbursementCount = $canApprove('reimbursement') ? $this->countScopedPending(Reimbursement::class, 'reimbursement', 'pending', $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;
        $permitCount = $canApprove('permit') ? $this->countScopedPending(Permit::class, 'permit', 'pending', $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;
        $vehicleCount = $canApprove('vehicle_log') ? $this->countScopedPending(VehicleLog::class, 'vehicle_log', ['pending', 'completed'], $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;
        $fundRequestCount = $canApprove('fund_request') ? $this->countScopedPending(FundRequest::class, 'fund_request', $fundRequestStatus, $user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) : 0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'leave' => $leaveCount,
                'overtime' => $overtimeCount,
                'reimbursement' => $reimbursementCount,
                'permit' => $permitCount,
                'fund_request' => $fundRequestCount,
                'vehicle_log' => $vehicleCount,
                'total' => $leaveCount + $overtimeCount + $reimbursementCount + $permitCount + $vehicleCount + $fundRequestCount,
            ],
        ]);
    }

    private function resolvePendingBaseQuery(string $type, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        return match ($type) {
            'leave' => Leave::with(['user.role', 'user.office'])->where('status', 'pending'),
            'overtime' => Overtime::with(['user.role', 'user.office'])->where('status', 'pending'),
            'reimbursement' => Reimbursement::with(['user.role', 'user.office'])->where('status', 'pending'),
            'permit' => Permit::with(['user.role', 'user.office'])->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with(['user.role', 'user.office', 'vehicle'])->whereIn('status', ['pending', 'completed']),
            'fund_request' => FundRequest::with(['user.role', 'user.office', 'supervisor', 'hrd'])->where(function ($q) use ($isGlobalAdmin, $isCompanyAdmin) {
                if ($isGlobalAdmin || $isCompanyAdmin) {
                    $q->whereIn('status', ['pending', 'approved_by_supervisor']);
                } else {
                    $q->where('status', 'pending');
                }
            }),
            default => null
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
            return true;
        })->values();
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

        if (!$isGlobalAdmin && isset(self::PERM_MAP[$type]) && !$user->hasPermission(self::PERM_MAP[$type])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses persetujuan untuk kategori ini.'
            ], 403);
        }

        $query = $this->resolvePendingBaseQuery((string)$type, $isGlobalAdmin, $isCompanyAdmin);
        if (!$query) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');
        if (!$isGlobalAdmin) {
            if ($isCompanyAdmin) {
                $query->where(function ($q) use ($user, $subordinateIds) {
                    $q->where('company_id', $user->company_id);
                    if ($subordinateIds->isNotEmpty()) {
                        $q->orWhereIn('user_id', $subordinateIds);
                    }
                });
            } else {
                $query->whereIn('user_id', $subordinateIds);
            }
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        if (!$isGlobalAdmin && $type !== 'vehicle_log') {
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

        $item->update($updateData);

        if ($request->type === 'leave' && $result['is_final'] && $result['status'] === 'approved') {
            LeaveController::processLeaveApprovalDeduction();
        }

        $typeText = $this->getTypeText($request->type);
        $routePath = $this->getRoutePath($request->type);

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
            $msg = "Pengajuan {$typeText} berhasil di-{$request->status} secara final.";
        } else {
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
            $msg = "Persetujuan tahap {$item->current_approval_step} berhasil. Menunggu tahap berikutnya.";
        }

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
            $targetStatus = $item->status === 'pending'
                ? ($request->status === 'approved' ? 'approved' : 'rejected')
                : ($request->status === 'approved' ? 'validated' : 'rejected');
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
        $typeText = $this->getTypeText($request->type);
        $routePath = $this->getRoutePath($request->type);

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
            'type' => 'required|in:leave,overtime,reimbursement,permit,vehicle_log,fund_request',
            'id' => 'required|integer',
            'status' => 'required|in:approved,rejected',
            'remark' => 'nullable|string',
        ]);

        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        if (!$isGlobalAdmin && isset(self::PERM_MAP[$request->type]) && !$user->hasPermission(self::PERM_MAP[$request->type])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menyetujui pengajuan ini.'
            ], 403);
        }

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');
        $model = match ($request->type) {
            'leave' => Leave::class,
            'overtime' => Overtime::class,
            'reimbursement' => Reimbursement::class,
            'permit' => Permit::class,
            'vehicle_log' => VehicleLog::class,
            'fund_request' => FundRequest::class,
        };

        $query = $model::where('id', $request->id);
        if (!$isGlobalAdmin) {
            if ($isCompanyAdmin) {
                $query->where(function ($q) use ($user, $subordinateIds) {
                    $q->where('company_id', $user->company_id);
                    if ($subordinateIds->isNotEmpty()) {
                        $q->orWhereIn('user_id', $subordinateIds);
                    }
                });
            } else {
                $query->whereIn('user_id', $subordinateIds);
            }
        }

        $item = $query->first();
        if (!$item) {
            return response()->json(['status' => 'error', 'message' => 'Pengajuan tidak ditemukan atau Anda tidak memiliki hak akses.'], 404);
        }

        if (!empty($item->current_approval_step)) {
            return $this->handleDynamicApproval($item, $request, $user);
        }

        return $this->handleLegacyApproval($item, $request, $user, $isGlobalAdmin, $isCompanyAdmin);
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

        $subordinatesQuery = User::with(['role', 'attendances' => function ($q) use ($today) {
            $q->whereDate('check_in', $today);
        }]);

        if ($directSubordinateIds->isNotEmpty()) {
            $subordinatesQuery->whereIn('id', $directSubordinateIds);
        } elseif ($isGlobalAdmin) {
            $subordinatesQuery->where('id', '!=', $user->id)->take(50);
        } elseif ($isCompanyAdmin) {
            $subordinatesQuery->where('company_id', $user->company_id)->where('id', '!=', $user->id)->take(50);
        } else {
            $subordinatesQuery->where('supervisor_id', $user->id);
        }

        $subordinates = $subordinatesQuery->get();

        $teamAttendance = $subordinates->map(function ($sub) {
            $attendance = $sub->attendances->first();

            return [
                'id' => $sub->id,
                'name' => $sub->name,
                'role' => $sub->role?->name ?? 'Karyawan',
                'photo_url' => $sub->profile_photo_url,
                'status' => $attendance ? ($attendance->check_out ? 'Selesai' : 'Hadir') : 'Belum Masuk',
                'check_in' => $attendance?->check_in ? Carbon::parse($attendance->check_in)->format('H:i') : null,
                'check_out' => $attendance?->check_out ? Carbon::parse($attendance->check_out)->format('H:i') : null,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $teamAttendance,
        ]);
    }
}
