<?php

namespace App\Services;

use App\Http\Controllers\LeaveController;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
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
use Illuminate\Support\Facades\Schema;

class ManagerApprovalService
{
    use Notifiable;

    private const ROUTE_FUND_REQUESTS = '/dashboard/fund-requests';
    private const ROUTE_ATTENDANCE = '/dashboard/attendance';
    private const ROUTE_PAYROLL_APPROVAL = '/dashboard/payroll/approval';

    public const PERM_MAP = [
        'leave' => 'approve-leaves',
        'overtime' => 'approve-overtimes',
        'reimbursement' => 'approve-reimbursements',
        'permit' => 'approve-permits',
        'vehicle_log' => 'approve-vehicle-logs',
        'fund_request' => 'approve-fund-requests',
        'payroll' => 'approve-payroll',
        'early_out' => 'approve-attendances',
        'attendance_correction' => 'approve-attendance-corrections',
        'dinas_luar' => 'approve-attendances',
    ];

    public const TYPE_TEXTS = [
        'leave' => 'Cuti',
        'overtime' => 'Lembur',
        'reimbursement' => 'Reimbursement',
        'permit' => 'Izin',
        'fund_request' => 'Pengajuan Dana',
        'vehicle_log' => 'Peminjaman Kendaraan',
        'payroll' => 'Payroll',
        'early_out' => 'Pulang Awal',
        'attendance_correction' => 'Koreksi Absen',
        'dinas_luar' => 'Dinas Luar',
    ];

    public const ROUTE_PATHS = [
        'leave' => '/dashboard/leaves',
        'overtime' => '/dashboard/overtimes',
        'reimbursement' => '/dashboard/reimbursements',
        'permit' => '/dashboard/permits',
        'fund_request' => self::ROUTE_FUND_REQUESTS,
        'vehicle_log' => '/dashboard/fleet-logs',
        'payroll' => self::ROUTE_PAYROLL_APPROVAL,
        'early_out' => self::ROUTE_ATTENDANCE,
        'attendance_correction' => '/dashboard/attendance-corrections',
        'dinas_luar' => self::ROUTE_ATTENDANCE,
    ];

    /**
     * Approve or Reject a request
     */
    public function updateRequestStatus(Request $request, User $user)
    {
        $request->validate([
            'type' => 'required|in:leave,overtime,reimbursement,permit,vehicle_log,fund_request,payroll,early_out,attendance_correction,dinas_luar',
            'id' => 'required|integer',
            'status' => 'required|in:approved,rejected',
            'remark' => 'nullable|string',
        ]);

        $isGlobalAdmin = $user->isSuperAdmin();
        $isCompanyAdmin = PendingRequestService::isExecutiveOrAdmin($user);

        if (! $this->canUserApproveRequest($user, $request->type, $isGlobalAdmin, $isCompanyAdmin)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda tidak memiliki hak akses untuk menyetujui pengajuan ini.',
            ], 403);
        }

        return match ($request->type) {
            'payroll' => $this->handlePayrollApproval($request, $user, $isGlobalAdmin),
            'early_out' => $this->handleEarlyOutApproval($request, $user, $isGlobalAdmin),
            'dinas_luar' => $this->handleDinasLuarApproval($request, $user, $isGlobalAdmin),
            default => $this->handleGeneralRequestApproval($request, $user, $isGlobalAdmin, $isCompanyAdmin),
        };
    }

    private function canUserApproveRequest(User $user, string $type, bool $isGlobalAdmin, bool $isCompanyAdmin): bool
    {
        if ($isGlobalAdmin || $isCompanyAdmin) {
            return true;
        }

        if (User::where('supervisor_id', $user->id)->exists()) {
            return true;
        }

        return !isset(self::PERM_MAP[$type]) || $user->hasPermission(self::PERM_MAP[$type]);
    }

    private function handleEarlyOutApproval(Request $request, User $user, bool $isGlobalAdmin)
    {
        $attendance = Attendance::with('user')
            ->where('id', $request->id)
            ->when(!$isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->first();

        if (!$attendance) {
            return response()->json(['status' => 'error', 'message' => 'Data absensi pulang awal tidak ditemukan.'], 404);
        }

        $isApproved = $request->status === 'approved';

        $attendance->update([
            'early_out_status' => $request->status,
            'early_out_approved_by' => $user->id,
            'early_out_approved_at' => now(),
            'early_out_rejection_reason' => $isApproved ? null : ($request->remark ?? 'Ditolak oleh Admin/Manager'),
            'is_suspicious' => $isApproved ? false : $attendance->is_suspicious,
        ]);

        $dateStr = Carbon::parse($attendance->check_out ?? $attendance->check_in)->format('d M Y');
        $this->notify(
            $attendance->user,
            $isApproved ? 'ABSEN PULANG AWAL DISETUJUI' : 'ABSEN PULANG AWAL DITOLAK',
            $isApproved
                ? "Permohonan Pulang Awal Anda pada tanggal {$dateStr} telah DISETUJUI oleh Super Admin."
                : "Permohonan Pulang Awal Anda pada tanggal {$dateStr} DITOLAK oleh Super Admin. Alasan: " . ($request->remark ?? '-'),
            $isApproved ? 'success' : 'danger',
            self::ROUTE_ATTENDANCE
        );

        $this->notifySuperAdmins(
            $attendance->company_id ?? $user->company_id,
            $isApproved ? 'ABSEN PULANG AWAL DISETUJUI' : 'ABSEN PULANG AWAL DITOLAK',
            "Permohonan Pulang Awal {$attendance->user?->name} tanggal {$dateStr} telah " . ($isApproved ? 'DISETUJUI' : 'DITOLAK') . " oleh {$user->name}." . ($request->remark ? " Catatan: {$request->remark}" : ''),
            $isApproved ? 'success' : 'danger',
            self::ROUTE_ATTENDANCE,
            $user->id
        );

        return response()->json([
            'status' => 'success',
            'message' => $isApproved ? 'Absensi pulang awal berhasil disetujui.' : 'Absensi pulang awal berhasil ditolak.',
            'data' => $attendance->fresh(),
        ]);
    }

    private function handleDinasLuarApproval(Request $request, User $user, bool $isGlobalAdmin)
    {
        $attendance = Attendance::with('user')
            ->where('id', $request->id)
            ->where('attendance_type', 'dinas_luar')
            ->when(!$isGlobalAdmin, fn($q) => $q->where('company_id', $user->company_id))
            ->first();

        if (!$attendance) {
            return response()->json(['status' => 'error', 'message' => 'Data absensi dinas luar tidak ditemukan.'], 404);
        }

        $isApproved = $request->status === 'approved';

        if ($isApproved) {
            $targetStatus = ($isGlobalAdmin || $user->hasPermission('manage-attendances') || $attendance->dinas_luar_status === 'approved_spv')
                ? 'approved_hr'
                : 'approved_spv';

            $attendance->update([
                'dinas_luar_status' => $targetStatus,
                'approved_by_hr' => ($targetStatus === 'approved_hr') ? $user->id : $attendance->approved_by_hr,
                'approved_at_hr' => ($targetStatus === 'approved_hr') ? now() : $attendance->approved_at_hr,
                'approved_by_spv' => ($targetStatus === 'approved_spv') ? $user->id : ($attendance->approved_by_spv ?? $user->id),
                'approved_at_spv' => ($targetStatus === 'approved_spv') ? now() : ($attendance->approved_at_spv ?? now()),
                'status' => ($targetStatus === 'approved_hr') ? 'present' : $attendance->status,
                'remark' => $request->remark,
            ]);
        } else {
            $attendance->update([
                'dinas_luar_status' => 'rejected',
                'rejection_reason' => $request->remark ?? 'Ditolak oleh Admin/Manager',
                'status' => 'alfa',
                'remark' => $request->remark,
            ]);
        }

        $dest = $attendance->dinas_luar_destination ?? 'Luar Kantor';
        if ($attendance->user) {
            $this->notify(
                $attendance->user,
                $isApproved ? 'ABSEN DINAS LUAR DISETUJUI' : 'ABSEN DINAS LUAR DITOLAK',
                $isApproved
                    ? "Permohonan Dinas Luar Anda ke {$dest} telah DISETUJUI." . ($request->remark ? " Catatan: {$request->remark}" : '')
                    : "Permohonan Dinas Luar Anda ke {$dest} DITOLAK. Alasan: " . ($request->remark ?? '-'),
                $isApproved ? 'success' : 'danger',
                self::ROUTE_ATTENDANCE
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => $isApproved ? 'Absensi dinas luar berhasil disetujui.' : 'Absensi dinas luar berhasil ditolak.',
            'data' => $attendance->fresh(),
        ]);
    }

    private function handlePayrollApproval(Request $request, User $user, bool $isGlobalAdmin)
    {
        return (new ManagerPayrollApprovalService())->handlePayrollApproval($request, $user, $isGlobalAdmin);
    }

    private function handleGeneralRequestApproval(Request $request, User $user, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        $model = match ($request->type) {
            'leave' => Leave::class,
            'overtime' => Overtime::class,
            'reimbursement' => Reimbursement::class,
            'permit' => Permit::class,
            'vehicle_log' => VehicleLog::class,
            'fund_request' => FundRequest::class,
            'attendance_correction' => AttendanceCorrection::class,
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

    private function handleDynamicApproval($item, Request $request, User $user)
    {
        $action = $request->status === 'approved' ? 'approve' : 'reject';
        $submitter = $item->user ?: User::find($item->user_id) ?: $user;

        $result = ApprovalService::processApproval(
            $request->type,
            $item->company_id ?? $user->company_id,
            $user,
            $submitter,
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

        $this->processDynamicApprovalPostAction($item, $request->type, $result);

        $typeText = self::TYPE_TEXTS[$request->type] ?? ucfirst($request->type);
        $routePath = self::ROUTE_PATHS[$request->type] ?? '/dashboard';
        $msg = $result['is_final']
            ? $this->sendFinalDynamicApprovalNotification($item, $request, $user, $result, $typeText, $routePath)
            : $this->sendStepDynamicApprovalNotification($item, $user, $result, $typeText, $routePath);

        return response()->json([
            'status' => 'success',
            'message' => $msg,
            'data' => $item,
        ]);
    }

    private function processDynamicApprovalPostAction($item, string $type, array $result): void
    {
        if (!$result['is_final'] || $result['status'] !== 'approved') {
            return;
        }

        if ($type === 'leave') {
            LeaveController::processLeaveApprovalDeduction();
        } elseif ($type === 'attendance_correction') {
            $this->applyAttendanceCorrectionToRecord($item);
        }
    }

    private function applyAttendanceCorrectionToRecord($item): void
    {
        $attendance = $item->attendance;
        if (!$attendance) {
            return;
        }

        $applyData = [];
        if ($item->corrected_check_in) {
            $applyData['check_in'] = $item->corrected_check_in;
        }
        if ($item->corrected_check_out) {
            $applyData['check_out'] = $item->corrected_check_out;
        }
        if (!empty($applyData)) {
            $attendance->update($applyData);
        }
    }

    private function prepareDynamicUpdateData($item, Request $request, User $user, array $result): array
    {
        $updateData = [
            'status' => $result['status'],
            'current_approval_step' => $result['current_approval_step'],
        ];

        $remarkText = $this->resolveDynamicRemarkText($request, $user);

        if ($request->type === 'fund_request' && empty($item->supervisor_approved_at)) {
            $updateData['supervisor_id'] = $user->id;
            $updateData['supervisor_approved_at'] = now();
        }

        if ($result['is_final']) {
            $this->applyFinalStepData($updateData, $item, $request->type, $user, $result['status'], $remarkText);
        } elseif (Schema::hasColumn($item->getTable(), 'remark')) {
            $updateData['remark'] = $remarkText;
        }

        return $updateData;
    }

    private function resolveDynamicRemarkText(Request $request, User $user): ?string
    {
        $isGlobalAdmin = $user->role_id === 1 || (method_exists($user, 'canAccessAllCompanies') && $user->canAccessAllCompanies());
        if (!$isGlobalAdmin) {
            return $request->remark;
        }

        $reasonPart = $request->filled('remark') ? ": {$request->remark}" : ' (Override Otorisasi Darurat)';
        return "[Disetujui Super Admin - {$user->name}]{$reasonPart}";
    }

    private function applyFinalStepData(array &$updateData, $item, string $type, User $user, string $status, ?string $remarkText): void
    {
        if ($type === 'fund_request') {
            $updateData['hrd_id'] = $user->id;
            $updateData['hrd_approved_at'] = now();
            if ($status === 'rejected') {
                $updateData['reject_reason'] = $remarkText;
                $updateData['rejected_at'] = now();
            }
        } else {
            $updateData['approved_by'] = $user->id;
        }

        if (Schema::hasColumn($item->getTable(), 'remark')) {
            $updateData['remark'] = $remarkText;
        }
    }

    private function sendFinalDynamicApprovalNotification($item, Request $request, User $user, array $result, string $typeText, string $routePath): string
    {
        $statusText = strtoupper($result['status'] === 'approved' ? 'DISETUJUI' : 'DITOLAK');
        $remarkSuffix = $request->remark ? " Catatan: {$request->remark}" : '';
        $notifLevel = $result['status'] === 'approved' ? 'success' : 'danger';

        if ($item->user) {
            $this->notify(
                $item->user,
                "PENGAJUAN {$typeText} {$statusText}",
                "Pengajuan {$typeText} Anda telah {$statusText}." . $remarkSuffix,
                $notifLevel,
                $routePath
            );
        }

        $this->notifySuperAdmins(
            $item->company_id ?? $user->company_id,
            "PENGAJUAN {$typeText} {$statusText}",
            "Pengajuan {$typeText} {$item->user?->name} telah {$statusText} oleh {$user->name}." . $remarkSuffix,
            $notifLevel,
            $routePath,
            $user->id
        );

        return "Pengajuan {$typeText} berhasil di-{$request->status} secara final.";
    }

    private function sendStepDynamicApprovalNotification($item, User $user, array $result, string $typeText, string $routePath): string
    {
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

        $this->notifySuperAdmins(
            $item->company_id ?? $user->company_id,
            "PROGRESS PENGAJUAN {$typeText}",
            "Pengajuan {$typeText} {$item->user?->name} telah disetujui di tahap {$item->current_approval_step} oleh {$user->name}. Menunggu: {$result['step_label']}.",
            'info',
            $routePath,
            $user->id
        );

        return "Pengajuan {$typeText} berhasil disetujui untuk tahap ini.";
    }

    private function handleLegacyApproval($item, Request $request, User $user, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        return (new ManagerLegacyApprovalService())->handleLegacyApproval($item, $request, $user, $isGlobalAdmin, $isCompanyAdmin);
    }
}
