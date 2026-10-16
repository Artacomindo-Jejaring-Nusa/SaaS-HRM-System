<?php

namespace App\Traits;

use App\Models\Attendance;
use App\Models\User;
use Illuminate\Http\Request;

trait HandlesAttendanceDinasLuar
{
    public function getDinasLuar(Request $request)
    {
        $user = $request->user();
        $query = Attendance::with(['user', 'spvApprover', 'hrApprover'])
            ->where('company_id', $user->company_id)
            ->where('attendance_type', 'dinas_luar');

        if ($request->status) {
            $query->where('dinas_luar_status', $request->status);
        } else {
            $query->whereIn('dinas_luar_status', ['pending', 'approved_spv']);
        }

        if (! $user->is_manager && ! $user->hasPermission('manage-attendance-corrections')) {
            $query->whereHas('user', fn ($q) => $q->where('supervisor_id', $user->id));
        }

        $records = $query->orderBy('check_in', 'desc')->paginate(15);

        return $this->successResponse($records, 'Data dinas luar berhasil diambil.');
    }

    public function pendingDinasLuar(Request $request)
    {
        $user = $request->user();
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1;

        $query = Attendance::with(['user.role', 'user.office', 'spvApprover', 'hrApprover'])
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'waiting_approval', 'approved_spv']);

        if (!$isGlobalAdmin && $user->company_id) {
            $query->where('company_id', $user->company_id);
        } elseif ($request->filled('company_id')) {
            $query->where('company_id', $request->company_id);
        }

        if (!$isGlobalAdmin && !$user->hasPermission('manage-attendance-corrections') && !$user->hasPermission('view-attendances')) {
            $query->whereHas('user', fn ($q) => $q->where('supervisor_id', $user->id));
        }

        \App\Services\PendingRequestService::applyDateFilter($query, $request, 'check_in');

        $records = $query->orderBy('check_in', 'desc')->get();

        return $this->successResponse($records, 'Data pending dinas luar berhasil diambil.');
    }

    public function approveDinasLuarSpv(Request $request, $id)
    {
        $user = $request->user();
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1;

        $attendance = Attendance::when(!$isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'waiting_approval'])
            ->findOrFail($id);

        $employee = $attendance->user;
        if (!$isGlobalAdmin && $employee && $employee->supervisor_id !== $user->id && ! $user->hasPermission('manage-attendance-corrections')) {
            return $this->errorResponse('Anda bukan supervisor karyawan ini.', 403);
        }

        $attendance->update([
            'dinas_luar_status' => 'approved_spv',
            'approved_by_spv' => $user->id,
            'approved_at_spv' => now(),
        ]);

        if ($employee) {
            $this->notify(
                $employee,
                'DINAS LUAR DISETUJUI SUPERVISOR',
                "Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah disetujui oleh Supervisor {$user->name}. Menunggu persetujuan HRD.",
                'success'
            );
        }

        $hrUsers = User::where('company_id', $attendance->company_id ?? $user->company_id)
            ->whereHas('role', fn ($q) => $q->where('name', 'like', '%HRD%')->orWhere('name', 'like', '%HR%'))
            ->get();

        foreach ($hrUsers as $hr) {
            $this->notify(
                $hr,
                'PERSETUJUAN DINAS LUAR (HRD)',
                "Dinas luar {$employee?->name} ke {$attendance->dinas_luar_destination} telah disetujui Supervisor. Mohon persetujuan akhir dari HRD.",
                'warning',
                '/dashboard/approvals'
            );
        }

        return $this->successResponse($attendance->fresh(), 'Dinas luar disetujui oleh Supervisor.');
    }

    public function approveDinasLuarHr(Request $request, $id)
    {
        $user = $request->user();
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1;

        $attendance = Attendance::when(!$isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['approved_spv', 'pending', 'waiting_approval'])
            ->findOrFail($id);

        $attendance->update([
            'dinas_luar_status' => 'approved_hr',
            'approved_by_hr' => $user->id,
            'approved_at_hr' => now(),
            'status' => 'present',
        ]);

        $employee = $attendance->user;
        if ($employee) {
            $this->notify(
                $employee,
                'DINAS LUAR DISETUJUI HRD',
                "Selamat! Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah disetujui sepenuhnya oleh HRD {$user->name}.",
                'success'
            );
        }

        return $this->successResponse($attendance->fresh(), 'Dinas luar disetujui oleh HRD.');
    }

    public function rejectDinasLuar(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string|max:500']);

        $user = $request->user();
        $isGlobalAdmin = $user->isSuperAdmin() || $user->role_id === 1;

        $attendance = Attendance::when(!$isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->where('attendance_type', 'dinas_luar')
            ->whereIn('dinas_luar_status', ['pending', 'waiting_approval', 'approved_spv'])
            ->findOrFail($id);

        $attendance->update([
            'dinas_luar_status' => 'rejected',
            'rejection_reason' => $request->reason,
            'status' => 'alfa',
        ]);

        $employee = $attendance->user;
        if ($employee) {
            $this->notify(
                $employee,
                'DINAS LUAR DITOLAK',
                "Pengajuan dinas luar Anda ke {$attendance->dinas_luar_destination} telah ditolak. Alasan: {$request->reason}",
                'danger'
            );
        }

        return $this->successResponse($attendance->fresh(), 'Dinas luar ditolak.');
    }
}
