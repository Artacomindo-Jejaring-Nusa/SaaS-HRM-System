<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
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
use App\Services\DataPurgeService;
use App\Services\PendingRequestService;
use App\Services\RequestHistoryService;
use App\Traits\Notifiable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ManagerController extends Controller
{
    use Notifiable;

    private const ROUTE_FUND_REQUESTS = '/dashboard/fund-requests';
    private const ROUTE_ATTENDANCE = '/dashboard/attendance';

    private const PERM_MAP = [
        'leave' => 'approve-leaves',
        'overtime' => 'approve-overtimes',
        'reimbursement' => 'approve-reimbursements',
        'permit' => 'approve-permits',
        'vehicle_log' => 'approve-vehicle-logs',
        'fund_request' => 'approve-fund-requests',
        'payroll' => 'approve-payroll',
        'early_out' => 'approve-attendances',
    ];

    /**
     * Check if user is an executive, HR, or admin
     */
    private function isExecutiveOrAdmin($user): bool
    {
        return PendingRequestService::isExecutiveOrAdmin($user);
    }

    private const TYPE_TEXTS = [
        'leave' => 'Cuti',
        'overtime' => 'Lembur',
        'reimbursement' => 'Reimbursement',
        'permit' => 'Izin',
        'fund_request' => 'Pengajuan Dana',
        'vehicle_log' => 'Peminjaman Kendaraan',
        'payroll' => 'Payroll',
        'early_out' => 'Pulang Awal',
    ];

    private const ROUTE_PATHS = [
        'leave' => '/dashboard/leaves',
        'overtime' => '/dashboard/overtimes',
        'reimbursement' => '/dashboard/reimbursements',
        'permit' => '/dashboard/permits',
        'fund_request' => self::ROUTE_FUND_REQUESTS,
        'vehicle_log' => '/dashboard/fleet-logs',
        'payroll' => '/dashboard/payroll/approval',
        'early_out' => self::ROUTE_ATTENDANCE,
    ];

    /**
     * Get summary count for pending requests
     */
    public function getPendingCount()
    {
        return response()->json([
            'status' => 'success',
            'data' => PendingRequestService::getPendingCount(Auth::user(), self::PERM_MAP),
        ]);
    }

    /**
     * Get list of pending requests by type
     */
    public function getPendingRequests(Request $request)
    {
        $items = PendingRequestService::getPendingRequests($request, Auth::user(), self::PERM_MAP);
        if ($items === null) {
            return response()->json(['status' => 'error', 'message' => 'Invalid request type'], 400);
        }

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
            return $this->sendFinalDynamicApprovalNotification($item, $request, $user, $result, $typeText, $routePath);
        }

        return $this->sendStepDynamicApprovalNotification($item, $user, $result, $typeText, $routePath);
    }

    private function sendFinalDynamicApprovalNotification($item, Request $request, $user, array $result, string $typeText, string $routePath): string
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

    private function sendStepDynamicApprovalNotification($item, $user, array $result, string $typeText, string $routePath): string
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

                $this->notifySuperAdmins(
                    $item->company_id ?? $user->company_id,
                    'PERSETUJUAN DANA (TAHAP SUPERVISOR)',
                    "Pengajuan dana {$item->user?->name} telah disetujui Supervisor ({$user->name}). Menunggu persetujuan akhir HRD.",
                    'info',
                    self::ROUTE_FUND_REQUESTS,
                    $user->id
                );

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

    private function determineLegacyTargetStatus($item, Request $request, $user, bool $isCompanyAdmin, bool $isGlobalAdmin): string
    {
        if ($request->type === 'fund_request') {
            return $this->updateLegacyFundRequest($item, $request, $user, $isCompanyAdmin, $isGlobalAdmin);
        }

        $targetStatus = $request->status;
        if ($request->type === 'vehicle_log') {
            if ($request->status === 'approved') {
                $targetStatus = ($item->status === 'pending') ? 'approved' : 'validated';
            } else {
                $targetStatus = 'rejected';
            }
        }

        $previousStatus = $item->status;
        $item->update([
            'status' => $targetStatus,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

        if ($request->type === 'leave') {
            if ($targetStatus === 'approved' && $previousStatus !== 'approved') {
                LeaveController::processLeaveApprovalDeduction();
            } elseif ($targetStatus === 'rejected' && $previousStatus === 'approved') {
                LeaveController::processLeaveApprovalRefund();
            }
        }

        return $targetStatus;
    }

    private function sendLegacyNotification($item, Request $request, string $typeText, string $routePath): void
    {
        if (!$item->user) {
            return;
        }

        $isApproved = $request->status === 'approved';
        $statusText = $isApproved ? 'DISETUJUI' : 'DITOLAK';
        $badge = $isApproved ? 'success' : 'danger';
        $remarkText = $request->remark ? " Catatan: {$request->remark}" : '';

        $this->notify(
            $item->user,
            "PENGAJUAN {$typeText} {$statusText}",
            "Pengajuan {$typeText} Anda telah {$statusText} oleh Manager/Admin.{$remarkText}",
            $badge,
            $routePath
        );

        $this->notifySuperAdmins(
            $item->company_id ?? $request->user()->company_id,
            "PENGAJUAN {$typeText} {$statusText}",
            "Pengajuan {$typeText} {$item->user?->name} telah {$statusText} oleh {$request->user()->name}.{$remarkText}",
            $badge,
            $routePath,
            $request->user()->id
        );
    }

    private function handleLegacyApproval($item, Request $request, $user, bool $isGlobalAdmin, bool $isCompanyAdmin)
    {
        $this->determineLegacyTargetStatus($item, $request, $user, $isCompanyAdmin, $isGlobalAdmin);

        $typeText = self::TYPE_TEXTS[$request->type] ?? ucfirst($request->type);
        $routePath = self::ROUTE_PATHS[$request->type] ?? '/dashboard';

        $this->sendLegacyNotification($item, $request, $typeText, $routePath);

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
            'type' => 'required|in:leave,overtime,reimbursement,permit,vehicle_log,fund_request,payroll,early_out',
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
            $response = $this->handlePayrollApproval($request, $user, $isGlobalAdmin);
        } elseif ($request->type === 'early_out') {
            $response = $this->handleEarlyOutApproval($request, $user, $isGlobalAdmin);
        } else {
            $response = $this->handleGeneralRequestApproval($request, $user, $isGlobalAdmin, $isCompanyAdmin);
        }

        return $response;
    }

    private function handleEarlyOutApproval(Request $request, $user, bool $isGlobalAdmin)
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

        $this->notifySuperAdmins(
            $batch->company_id ?? $user->company_id,
            $isApproved ? 'BATCH PAYROLL DISETUJUI' : 'BATCH PAYROLL DITOLAK',
            "Batch payroll '{$batch->batch_number}' telah " . ($isApproved ? 'DISETUJUI' : 'DITOLAK') . " oleh {$user->name}." . ($request->remark ? " Catatan: {$request->remark}" : ''),
            $isApproved ? 'success' : 'danger',
            '/dashboard/payroll/approval',
            $user->id
        );

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
    public function getTeamAttendance(\App\Services\ManagerAttendanceService $attendanceService)
    {
        $user = Auth::user();
        $isCompanyAdmin = $this->isExecutiveOrAdmin($user) || $user->hasPermission('view-attendances');

        return response()->json([
            'status' => 'success',
            'data' => $attendanceService->getTeamAttendance($user, $isCompanyAdmin),
        ]);
    }

    /**
     * Get processed requests and audit history
     */
    public function getHistoryRequests(Request $request)
    {
        $sorted = RequestHistoryService::getHistoryRequests($request, Auth::user());

        return response()->json([
            'status' => 'success',
            'data' => $sorted,
        ]);
    }

    /**
     * Purge requests and files for the specified/current month (Super Admin only)
     */
    public function purgeCurrentMonth(Request $request)
    {
        return DataPurgeService::purgeCurrentMonth(
            $request,
            Auth::user(),
            fn (...$args) => $this->logActivity(...$args)
        );
    }
}
