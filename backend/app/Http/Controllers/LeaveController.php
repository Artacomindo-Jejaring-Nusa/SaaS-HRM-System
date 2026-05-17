<?php

namespace App\Http\Controllers;

use App\Models\Leave;
use App\Models\User;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    use Notifiable;

    private const TYPE_ANNUAL_LEAVE = 'Cuti Tahunan';

    public function index(Request $request)
    {
        $query = Leave::with(['user.supervisor', 'supervisorApprover', 'hrApprover']);

        $user = $request->user();

        if ($user->role_id === 1) {
            // Master Admin sees all
        } elseif ($user->is_manager || $user->hasPermission('approve-leaves')) {
            $query->where('company_id', $user->company_id);
        } else {
            $query->where('user_id', $user->id)
                ->where('company_id', $user->company_id);
        }

        $leaves = $query->orderBy('id', 'desc')->paginate(10);

        return response()->json([
            'status' => 'success',
            'message' => 'Data cuti berhasil diambil.',
            'data' => $leaves,
            'leave_balance' => $user->leave_balance,
        ]);
    }

    public function calendar(Request $request)
    {
        $query = Leave::with('user')->where('status', 'approved');

        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($request->month && $request->year) {
            $start = Carbon::create($request->year, $request->month, 1)->startOfMonth();
            $end = Carbon::create($request->year, $request->month, 1)->endOfMonth();

            $query->where(function ($q) use ($start, $end) {
                $q->whereBetween('start_date', [$start, $end])
                    ->orWhereBetween('end_date', [$start, $end]);
            });
        }

        $leaves = $query->get();

        return $this->successResponse($leaves, 'Data kalender cuti berhasil diambil.');
    }

    public function store(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'type' => 'required|string',
            'reason' => 'nullable|string',
            'signature' => 'required|string', // Base64 signature
        ]);

        if ($request->type === self::TYPE_ANNUAL_LEAVE) {
            $requestedDays = Carbon::parse($request->start_date)->diffInDays(Carbon::parse($request->end_date)) + 1;

            $pendingDays = Leave::where('user_id', $request->user()->id)
                ->where('type', self::TYPE_ANNUAL_LEAVE)
                ->whereIn('status', ['pending', 'pending_supervisor', 'pending_hr'])
                ->get()
                ->sum(function ($l) {
                    return Carbon::parse($l->start_date)->diffInDays(Carbon::parse($l->end_date)) + 1;
                });

            if ($request->user()->leave_balance < ($requestedDays + $pendingDays)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Sisa cuti tahunan Anda tidak mencukupi (termasuk cuti yang masih pending/menunggu).',
                ], 400);
            }
        }

        $status = $request->user()->supervisor_id ? 'pending_supervisor' : 'pending_hr';

        $leave = Leave::create([
            'user_id' => $request->user()->id,
            'company_id' => $request->user()->company_id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'type' => $request->type,
            'reason' => $request->reason,
            'signature' => $request->signature,
            'status' => $status,
        ]);

        $this->notify(
            $request->user(),
            'PENGAJUAN CUTI BERHASIL',
            "Permohonan cuti ({$request->type}) Anda dari tanggal {$request->start_date} s/d {$request->end_date} telah diajukan dan sedang menunggu persetujuan.",
            'info'
        );

        // 1. Notify the User's Immediate Supervisor
        if ($request->user()->supervisor_id) {
            $supervisor = $request->user()->supervisor;
            if ($supervisor) {
                $this->notify(
                    $supervisor,
                    'PENGAJUAN CUTI BAWAHAN',
                    "{$request->user()->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date}. Mohon segera tinjau.",
                    'warning',
                    '/dashboard/approvals'
                );
            }
        }

        // 2. Notify Admins and HR (Fallback or Additional)
        $admins = User::where('company_id', $request->user()->company_id)
            ->where('role_id', '>', 1) // Any role above Karyawan
            ->where('id', '!=', $request->user()->supervisor_id) // Don't notify twice if supervisor is also admin
            ->get();

        foreach ($admins as $admin) {
            $this->notify(
                $admin,
                'PENGAJUAN CUTI BARU (ADMIN)',
                "{$request->user()->name} telah mengajukan cuti ({$request->type}) pada {$request->start_date}.",
                'warning'
            );
        }

        return $this->successResponse($leave, 'Permohonan cuti berhasil diajukan.', 201);
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $leave = Leave::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        $isSupervisor = $leave->user->supervisor_id === $user->id;
        $isHR = $user->hasPermission('approve-leaves') || $user->role_id === 1;

        if ($leave->status === 'pending_supervisor') {
            if (! $isSupervisor && ! $isHR) {
                return response()->json(['status' => 'error', 'message' => 'Anda tidak berhak.'], 403);
            }
            if ($isSupervisor) {
                $leave->update([
                    'status' => 'pending_hr',
                    'supervisor_approved_by' => $user->id,
                    'supervisor_approved_at' => now(),
                    'supervisor_remark' => $request->remark,
                ]);
                $this->notify($leave->user, 'CUTI DI-APPROVE ATASAN', 'Menunggu HRD.', 'info');

                return $this->successResponse(null, 'Di-approve oleh atasan. Menunggu proses HRD.');
            } elseif ($isHR) {
                // HR forcefully bypasses supervisor
                $leave->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'remark' => $request->remark,
                    'supervisor_approved_by' => $user->id,
                    'supervisor_approved_at' => now(),
                ]);
            }
        } elseif (in_array($leave->status, ['pending_hr', 'pending'])) {
            if (! $isHR) {
                return response()->json(['status' => 'error', 'message' => 'Hanya HRD.'], 403);
            }
            $leave->update([
                'status' => 'approved',
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);
        } else {
            return response()->json(['status' => 'error', 'message' => 'Status tidak valid.'], 400);
        }

        if ($leave->type === 'Cuti Tahunan') {
            $days = Carbon::parse($leave->start_date)->diffInDays(Carbon::parse($leave->end_date)) + 1;
            $leaveUser = $leave->user;
            $leaveUser->leave_balance -= $days;
            $leaveUser->save();
        }

        $this->notify(
            $leave->user,
            'CUTI DISETUJUI',
            "Permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DISETUJUI oleh Admin.",
            'success'
        );

        // Notification is already handled by $this->notify above.
        // It now includes Database, FCM, Email, and WhatsApp.

        return $this->successResponse(null, 'Permohonan cuti disetujui.');
    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $leave = Leave::findOrFail($id);

        $isSupervisor = $leave->user->supervisor_id === $user->id;
        $isHR = $user->hasPermission('approve-leaves') || $user->role_id === 1;

        if (! $isSupervisor && ! $isHR) {
            abort(403, 'Akses ditolak.');
        }

        if ($leave->status === 'pending_supervisor' && $isSupervisor) {
            $leave->update([
                'status' => 'rejected',
                'supervisor_approved_by' => $user->id,
                'supervisor_approved_at' => now(),
                'supervisor_remark' => $request->remark,
            ]);
        } else {
            $leave->update([
                'status' => 'rejected',
                'approved_by' => $user->id,
                'remark' => $request->remark,
            ]);
        }

        $this->notify(
            $leave->user,
            'CUTI DITOLAK',
            "Mohon maaf, permohonan cuti Anda untuk tanggal {$leave->start_date} s/d {$leave->end_date} telah DITOLAK.",
            'danger'
        );

        // Notification is already handled by $this->notify above.

        return $this->successResponse(null, 'Permohonan cuti ditolak.');
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $leave = Leave::where(function ($q) use ($user) {
            if ($user->role_id !== 1) {
                $q->where('company_id', $user->company_id);
            }
        })->findOrFail($id);

        if (! in_array($leave->status, ['pending', 'pending_supervisor', 'pending_hr']) && $user->role_id !== 1) {
            return $this->errorResponse('Cuti yang sudah diproses tidak bisa dihapus.', 403);
        }

        $leave->delete();

        return $this->successResponse(null, 'Cuti berhasil dihapus.');
    }
}
