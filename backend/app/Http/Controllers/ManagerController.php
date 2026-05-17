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
        $userId = Auth::id();
        $subordinateIds = User::where('supervisor_id', $userId)->pluck('id');

        $leaveCount = Leave::whereIn('user_id', $subordinateIds)->where('status', 'pending')->count();
        $overtimeCount = Overtime::whereIn('user_id', $subordinateIds)->where('status', 'pending')->count();
        $reimbursementCount = Reimbursement::whereIn('user_id', $subordinateIds)->where('status', 'pending')->count();
        $permitCount = Permit::whereIn('user_id', $subordinateIds)->where('status', 'pending')->count();
        $vehicleCount = VehicleLog::whereIn('user_id', $subordinateIds)->where('status', 'completed')->count();

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
        $userId = Auth::id();
        $subordinateIds = User::where('supervisor_id', $userId)->pluck('id');
        $type = $request->type; // leave, overtime, reimbursement

        $query = match ($type) {
            'leave' => Leave::with('user')->whereIn('user_id', $subordinateIds)->where('status', 'pending'),
            'overtime' => Overtime::with('user')->whereIn('user_id', $subordinateIds)->where('status', 'pending'),
            'reimbursement' => Reimbursement::with('user')->whereIn('user_id', $subordinateIds)->where('status', 'pending'),
            'permit' => Permit::with('user')->whereIn('user_id', $subordinateIds)->where('status', 'pending'),
            'vehicle_log' => VehicleLog::with('user')->whereIn('user_id', $subordinateIds)->where('status', 'completed'),
            default => null
        };

        if (! $query) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10),
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

        $userId = Auth::id();
        $subordinateIds = User::where('supervisor_id', $userId)->pluck('id');

        $model = match ($request->type) {
            'leave' => Leave::class,
            'overtime' => Overtime::class,
            'reimbursement' => Reimbursement::class,
            'permit' => Permit::class,
            'vehicle_log' => VehicleLog::class,
        };

        $item = $model::where('id', $request->id)->whereIn('user_id', $subordinateIds)->first();

        if (! $item) {
            return response()->json(['status' => 'error', 'message' => 'Request not found or not authorized'], 404);
        }

        $item->update([
            'status' => $request->status,
            'approved_by' => $userId,
            'remark' => $request->remark,
        ]);

        // Notify the Employee
        $statusText = strtoupper($request->status === 'approved' ? 'DISETUJUI' : 'DITOLAK');
        $typeText = match ($request->type) {
            'leave' => 'Cuti',
            'overtime' => 'Lembur',
            'reimbursement' => 'Reimbursement',
            'permit' => 'Izin',
            'vehicle_log' => 'Vehicle Log',
        };

        $this->notify(
            $item->user,
            "PENGAJUAN {$typeText} {$statusText}",
            "Pengajuan {$typeText} Anda telah {$statusText} oleh Manager.".($request->remark ? " Catatan: {$request->remark}" : ''),
            $request->status === 'approved' ? 'success' : 'danger',
            $request->type === 'leave' ? '/dashboard/leaves' : ($request->type === 'overtime' ? '/dashboard/overtimes' : ($request->type === 'reimbursement' ? '/dashboard/reimbursements' : ($request->type === 'permit' ? '/dashboard/permits' : '/dashboard/fleet-logs')))
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Request successfully '.$request->status,
            'data' => $item,
        ]);
    }

    /**
     * Get team attendance status for today
     */
    public function getTeamAttendance()
    {
        $userId = Auth::id();
        $today = Carbon::today()->toDateString();

        $subordinates = User::where('supervisor_id', $userId)
            ->with(['role', 'attendances' => function ($q) use ($today) {
                $q->whereDate('check_in', $today);
            }])
            ->get();

        $teamAttendance = $subordinates->map(function ($sub) {
            $attendance = $sub->attendances->first();

            return [
                'id' => $sub->id,
                'name' => $sub->name,
                'role' => $sub->role?->name,
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
