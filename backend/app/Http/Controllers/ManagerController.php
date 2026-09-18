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
     * Get summary count for pending requests
     */
    public function getPendingCount()
    {
        $user = Auth::user();
        $isGlobalAdmin = $user->role_id === 1;
        $roleName = strtolower($user->role?->name ?? '');
        $isCompanyAdmin = $user->is_manager 
            || $user->hasPermission('approve-leaves') 
            || str_contains($roleName, 'admin') 
            || str_contains($roleName, 'hrd') 
            || str_contains($roleName, 'direktur');

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
        $roleName = strtolower($user->role?->name ?? '');
        $isCompanyAdmin = $user->is_manager 
            || $user->hasPermission('approve-leaves') 
            || str_contains($roleName, 'admin') 
            || str_contains($roleName, 'hrd') 
            || str_contains($roleName, 'direktur');

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
        $roleName = strtolower($user->role?->name ?? '');
        $isCompanyAdmin = $user->is_manager 
            || $user->hasPermission('approve-leaves') 
            || str_contains($roleName, 'admin') 
            || str_contains($roleName, 'hrd') 
            || str_contains($roleName, 'direktur');

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
        $roleName = strtolower($user->role?->name ?? '');
        $isCompanyAdmin = $user->is_manager 
            || $user->hasPermission('view-attendances') 
            || str_contains($roleName, 'admin') 
            || str_contains($roleName, 'hrd') 
            || str_contains($roleName, 'direktur');

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
