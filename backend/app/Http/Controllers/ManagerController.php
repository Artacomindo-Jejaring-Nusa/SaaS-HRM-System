<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
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
            || str_contains($roleName, 'admin') 
            || str_contains($roleName, 'hrd') 
            || str_contains($roleName, 'hr') 
            || str_contains($roleName, 'direktur')
            || str_contains($roleName, 'director')
            || str_contains($roleName, 'coo')
            || str_contains($roleName, 'ceo')
            || str_contains($roleName, 'boc')
            || str_contains($roleName, 'management');
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

        $buildScope = function ($modelClass, $pendingStatus = 'pending') use ($user, $isGlobalAdmin, $isCompanyAdmin, $subordinateIds) {
            $query = $modelClass::where('status', $pendingStatus);
            if ($isGlobalAdmin) {
                // Global Admin sees all
            } elseif ($isCompanyAdmin) {
                $query->where(function ($q) use ($user, $subordinateIds) {
                    $q->where('company_id', $user->company_id);
                    if ($subordinateIds->isNotEmpty()) {
                        $q->orWhereIn('user_id', $subordinateIds);
                    }
                });
            } else {
                $query->whereIn('user_id', $subordinateIds);
            }
            return $query->count();
        };

        $leaveCount = $buildScope(Leave::class, 'pending');
        $overtimeCount = $buildScope(Overtime::class, 'pending');
        $reimbursementCount = $buildScope(Reimbursement::class, 'pending');
        $permitCount = $buildScope(Permit::class, 'pending');
        $vehicleCount = $buildScope(VehicleLog::class, 'completed');

        return response()->json([
            'status' => 'success',
            'data' => [
                'leave' => $leaveCount,
                'overtime' => $overtimeCount,
                'reimbursement' => $reimbursementCount,
                'permit' => $permitCount,
                'vehicle_log' => $vehicleCount,
                'total' => $leaveCount + $overtimeCount + $reimbursementCount + $permitCount + $vehicleCount,
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

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');
        $type = $request->type; // leave, overtime, reimbursement, permit, vehicle_log

        $query = match ($type) {
            'leave' => Leave::with(['user.role', 'user.office'])->where('status', 'pending'),
            'overtime' => Overtime::with(['user.role', 'user.office'])->where('status', 'pending'),
            'reimbursement' => Reimbursement::with(['user.role', 'user.office'])->where('status', 'pending'),
            'permit' => Permit::with(['user.role', 'user.office'])->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with(['user.role', 'user.office', 'vehicle'])->where('status', 'completed'),
            default => null
        };

        if (! $query) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        if ($isGlobalAdmin) {
            // Global Admin sees all
        } elseif ($isCompanyAdmin) {
            $query->where(function ($q) use ($user, $subordinateIds) {
                $q->where('company_id', $user->company_id);
                if ($subordinateIds->isNotEmpty()) {
                    $q->orWhereIn('user_id', $subordinateIds);
                }
            });
        } else {
            $query->whereIn('user_id', $subordinateIds);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

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
            'type' => 'required|in:leave,overtime,reimbursement,permit,vehicle_log',
            'id' => 'required|integer',
            'status' => 'required|in:approved,rejected',
            'remark' => 'nullable|string',
        ]);

        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user);

        $subordinateIds = User::where('supervisor_id', $user->id)->pluck('id');

        $model = match ($request->type) {
            'leave' => Leave::class,
            'overtime' => Overtime::class,
            'reimbursement' => Reimbursement::class,
            'permit' => Permit::class,
            'vehicle_log' => VehicleLog::class,
        };

        $query = $model::where('id', $request->id);
        if ($isGlobalAdmin) {
            // Global Admin can approve all
        } elseif ($isCompanyAdmin) {
            $query->where(function ($q) use ($user, $subordinateIds) {
                $q->where('company_id', $user->company_id);
                if ($subordinateIds->isNotEmpty()) {
                    $q->orWhereIn('user_id', $subordinateIds);
                }
            });
        } else {
            $query->whereIn('user_id', $subordinateIds);
        }

        $item = $query->first();

        if (! $item) {
            return response()->json(['status' => 'error', 'message' => 'Pengajuan tidak ditemukan atau Anda tidak memiliki hak akses.'], 404);
        }

        // Handle dynamic multi-step approval if enabled on this item
        if ($request->type !== 'vehicle_log' && !empty($item->current_approval_step)) {
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

                if ($result['is_final']) {
                    $updateData['approved_by'] = $user->id;
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
                    default => ucfirst($request->type),
                };

                if ($result['is_final']) {
                    $statusText = strtoupper($result['status'] === 'approved' ? 'DISETUJUI' : 'DITOLAK');
                    if ($item->user) {
                        $this->notify(
                            $item->user,
                            "PENGAJUAN {$typeText} {$statusText}",
                            "Pengajuan {$typeText} Anda telah {$statusText}.".($request->remark ? " Catatan: {$request->remark}" : ''),
                            $result['status'] === 'approved' ? 'success' : 'danger',
                            $request->type === 'leave' ? '/dashboard/leaves' : ($request->type === 'overtime' ? '/dashboard/overtimes' : ($request->type === 'reimbursement' ? '/dashboard/reimbursements' : '/dashboard/permits'))
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
                                $request->type === 'leave' ? '/dashboard/leaves' : ($request->type === 'overtime' ? '/dashboard/overtimes' : ($request->type === 'reimbursement' ? '/dashboard/reimbursements' : '/dashboard/permits'))
                            );
                        }
                    }
                    if ($item->user) {
                        $this->notify(
                            $item->user,
                            "PROGRESS PENGAJUAN {$typeText}",
                            "Pengajuan {$typeText} Anda telah disetujui oleh {$user->name} dan berlanjut ke tahap berikutnya.",
                            'info',
                            $request->type === 'leave' ? '/dashboard/leaves' : ($request->type === 'overtime' ? '/dashboard/overtimes' : ($request->type === 'reimbursement' ? '/dashboard/reimbursements' : '/dashboard/permits'))
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

        // Fallback single-step flow
        $targetStatus = $request->status;
        if ($request->type === 'vehicle_log') {
            $targetStatus = $request->status === 'approved' ? 'validated' : 'rejected';
        }

        $previousStatus = $item->status;

        $item->update([
            'status' => $targetStatus,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

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
            'vehicle_log' => 'Log Kendaraan',
        };

        if ($item->user) {
            $this->notify(
                $item->user,
                "PENGAJUAN {$typeText} {$statusText}",
                "Pengajuan {$typeText} Anda telah {$statusText} oleh Manager/Admin.".($request->remark ? " Catatan: {$request->remark}" : ''),
                $request->status === 'approved' ? 'success' : 'danger',
                $request->type === 'leave' ? '/dashboard/leaves' : ($request->type === 'overtime' ? '/dashboard/overtimes' : ($request->type === 'reimbursement' ? '/dashboard/reimbursements' : ($request->type === 'permit' ? '/dashboard/permits' : '/dashboard/fleet-logs')))
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
