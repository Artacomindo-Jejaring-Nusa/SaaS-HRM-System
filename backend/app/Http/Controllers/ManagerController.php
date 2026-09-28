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

    /**
     * Get summary count for pending requests
     */
    public function getPendingCount()
    {
        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        $permMap = [
            'leave' => 'approve-leaves',
            'overtime' => 'approve-overtimes',
            'reimbursement' => 'approve-reimbursements',
            'permit' => 'approve-permits',
            'vehicle_log' => 'approve-vehicle-logs',
            'fund_request' => 'approve-fund-requests',
        ];

        $canApproveType = function ($type) use ($user, $isGlobalAdmin, $permMap) {
            if ($isGlobalAdmin || $user->hasPermission('manage-approvals')) {
                return true;
            }
            if (isset($permMap[$type])) {
                return $user->hasPermission($permMap[$type]);
            }
            return false;
        };

        $buildScope = function ($modelClass, $type, $pendingStatus = 'pending') use ($user, $isGlobalAdmin, $canApproveType) {
            if (!$canApproveType($type)) {
                return 0;
            }

            $query = is_array($pendingStatus)
                ? $modelClass::whereIn('status', $pendingStatus)
                : $modelClass::where('status', $pendingStatus);

            if (!$isGlobalAdmin) {
                $query->where('company_id', $user->company_id);
            }

            $items = $query->with(['user.supervisor', 'user.role'])->get();

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

                // Fallback for non-dynamic workflow items
                if ($item->status === 'pending_supervisor') {
                    return $item->user?->supervisor_id === $user->id;
                }

                if ($item->status === 'pending_hr') {
                    return $user->hasPermission('approve-leaves') || $user->hasPermission('approve-permits') || $user->role_id === 1;
                }

                if ($user->supervisor_id && $item->user_id) {
                    return $item->user?->supervisor_id === $user->id;
                }

                return false;
            })->count();
        };

        $leaveCount = $buildScope(Leave::class, 'leave', 'pending');
        $overtimeCount = $buildScope(Overtime::class, 'overtime', 'pending');
        $reimbursementCount = $buildScope(Reimbursement::class, 'reimbursement', 'pending');
        $permitCount = $buildScope(Permit::class, 'permit', 'pending');
        $vehicleCount = $buildScope(VehicleLog::class, 'vehicle_log', ['pending', 'completed']);
        $fundRequestCount = $buildScope(FundRequest::class, 'fund_request', ['pending', 'approved_by_supervisor']);

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

    /**
     * Get list of pending requests by type
     */
    public function getPendingRequests(Request $request)
    {
        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        $type = $request->type; // leave, overtime, reimbursement, permit, vehicle_log, fund_request

        $permMap = [
            'leave' => 'approve-leaves',
            'overtime' => 'approve-overtimes',
            'reimbursement' => 'approve-reimbursements',
            'permit' => 'approve-permits',
            'vehicle_log' => 'approve-vehicle-logs',
            'fund_request' => 'approve-fund-requests',
        ];

        // If category permission is disabled by Super Admin for this role, return empty list
        if (!$isGlobalAdmin && !$user->hasPermission('manage-approvals')) {
            if (isset($permMap[$type]) && !$user->hasPermission($permMap[$type])) {
                return response()->json([
                    'status' => 'success',
                    'data' => [],
                ]);
            }
        }

        $query = match ($type) {
            'leave' => Leave::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'overtime' => Overtime::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'reimbursement' => Reimbursement::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'permit' => Permit::with(['user.role', 'user.office', 'user.supervisor'])->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with(['user.role', 'user.office', 'user.supervisor', 'vehicle'])->whereIn('status', ['pending', 'completed']),
            'fund_request' => FundRequest::with(['user.role', 'user.office', 'user.supervisor', 'supervisor', 'hrd'])->whereIn('status', ['pending', 'approved_by_supervisor']),
            default => null
        };

        if (! $query) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        if (!$isGlobalAdmin) {
            $query->where('company_id', $user->company_id);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        // Strictly filter items: only include items where the current user is authorized to act on the current step
        $items = $items->filter(function ($item) use ($type, $user) {
            if (!empty($item->current_approval_step) && $item->user) {
                return \App\Services\ApprovalService::canApprove(
                    $type,
                    $item->company_id ?? $user->company_id,
                    $user,
                    $item->user,
                    $item->current_approval_step
                );
            }

            if ($item->status === 'pending_supervisor') {
                return $item->user?->supervisor_id === $user->id;
            }

            if ($item->status === 'pending_hr') {
                return $user->hasPermission('approve-leaves') || $user->hasPermission('approve-permits') || $user->role_id === 1;
            }

            if ($user->supervisor_id && $item->user_id) {
                return $item->user?->supervisor_id === $user->id;
            }

            return false;
        })->values();

        // Attach current_step_info for each item if using dynamic workflow
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

        $permMap = [
            'leave' => 'approve-leaves',
            'overtime' => 'approve-overtimes',
            'reimbursement' => 'approve-reimbursements',
            'permit' => 'approve-permits',
            'vehicle_log' => 'approve-vehicle-logs',
            'fund_request' => 'approve-fund-requests',
        ];

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        // Only block users who have no manager/executive status, no subordinates, and no permission
        if (! $isGlobalAdmin && ! $isCompanyAdmin && $subordinateIds->isEmpty() && isset($permMap[$request->type]) && ! $user->hasPermission($permMap[$request->type])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menyetujui pengajuan ini.'
            ], 403);
        }

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

        if (! $item) {
            return response()->json(['status' => 'error', 'message' => 'Pengajuan tidak ditemukan atau Anda tidak memiliki hak akses.'], 404);
        }

        // Handle dynamic multi-step approval if enabled on this item
        if (!empty($item->current_approval_step)) {
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

            if ($result) {
                $updateData = [
                    'status' => $result['status'],
                    'current_approval_step' => $result['current_approval_step'],
                ];

                if ($request->type === 'fund_request') {
                    if (empty($item->supervisor_approved_at)) {
                        $updateData['supervisor_id'] = $user->id;
                        $updateData['supervisor_approved_at'] = now();
                    }
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

                // If final approval on leave, adjust employee leave quota
                if ($request->type === 'leave' && $result['is_final'] && $result['status'] === 'approved') {
                    LeaveController::processLeaveApprovalDeduction($item);
                }

                $typeText = match ($request->type) {
                    'leave' => 'Cuti',
                    'overtime' => 'Lembur',
                    'reimbursement' => 'Reimbursement',
                    'permit' => 'Izin',
                    'fund_request' => 'Pengajuan Dana',
                    'vehicle_log' => 'Peminjaman Kendaraan',
                    default => ucfirst($request->type),
                };

                $routePath = match ($request->type) {
                    'leave' => '/dashboard/leaves',
                    'overtime' => '/dashboard/overtimes',
                    'reimbursement' => '/dashboard/reimbursements',
                    'permit' => '/dashboard/permits',
                    'fund_request' => '/dashboard/fund-requests',
                    'vehicle_log' => '/dashboard/fleet-logs',
                    default => '/dashboard',
                };

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
        }

        // Fallback single / two-step flow
        $targetStatus = $request->status;
        if ($request->type === 'vehicle_log') {
            if ($item->status === 'pending') {
                $targetStatus = $request->status === 'approved' ? 'approved' : 'rejected';
            } else {
                $targetStatus = $request->status === 'approved' ? 'validated' : 'rejected';
            }
        }

        $previousStatus = $item->status;

        if ($request->type === 'fund_request') {
            if ($request->status === 'approved') {
                if ($item->status === 'pending' && !$isCompanyAdmin && !$isGlobalAdmin) {
                    $targetStatus = 'approved_by_supervisor';
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
                            '/dashboard/fund-requests'
                        );
                    }
                } else {
                    $targetStatus = 'approved';
                    $item->update([
                        'status' => 'approved',
                        'hrd_id' => $user->id,
                        'hrd_approved_at' => now(),
                        'remark' => $request->remark,
                    ]);
                }
            } else {
                $targetStatus = 'rejected';
                $item->update([
                    'status' => 'rejected',
                    'hrd_id' => $user->id,
                    'rejected_at' => now(),
                    'reject_reason' => $request->remark,
                    'remark' => $request->remark,
                ]);
            }
        } else {
            $item->update([
                'status' => $targetStatus,
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);
        }

        // If leave is approved/rejected, adjust employee's leave balance accordingly
        if ($request->type === 'leave') {
            if ($targetStatus === 'approved' && $previousStatus !== 'approved') {
                LeaveController::processLeaveApprovalDeduction($item);
            } elseif ($targetStatus === 'rejected' && $previousStatus === 'approved') {
                LeaveController::processLeaveApprovalRefund($item);
            }
        }

        // Notify the Employee
        $statusText = strtoupper($request->status === 'approved' ? 'DISETUJUI' : 'DITOLAK');
        $typeText = match ($request->type) {
            'leave' => 'Cuti',
            'overtime' => 'Lembur',
            'reimbursement' => 'Reimbursement',
            'permit' => 'Izin',
            'vehicle_log' => 'Peminjaman Kendaraan',
            'fund_request' => 'Pengajuan Dana',
            default => ucfirst($request->type),
        };

        $routePath = match ($request->type) {
            'leave' => '/dashboard/leaves',
            'overtime' => '/dashboard/overtimes',
            'reimbursement' => '/dashboard/reimbursements',
            'permit' => '/dashboard/permits',
            'vehicle_log' => '/dashboard/fleet-logs',
            'fund_request' => '/dashboard/fund-requests',
            default => '/dashboard',
        };

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
