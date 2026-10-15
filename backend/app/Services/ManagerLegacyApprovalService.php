<?php

namespace App\Services;

use App\Http\Controllers\LeaveController;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManagerLegacyApprovalService
{
    use Notifiable;

    private const ROUTE_FUND_REQUESTS = '/dashboard/fund-requests';

    public function __construct(
        private readonly ?ManagerApprovalService $mainApprovalService = null
    ) {}

    public function handleLegacyApproval($item, Request $request, User $user, bool $isGlobalAdmin, bool $isCompanyAdmin): JsonResponse
    {
        $this->determineLegacyTargetStatus($item, $request, $user, $isCompanyAdmin, $isGlobalAdmin);

        $typeText = ManagerApprovalService::TYPE_TEXTS[$request->type] ?? ucfirst($request->type);
        $routePath = ManagerApprovalService::ROUTE_PATHS[$request->type] ?? '/dashboard';

        $this->sendLegacyNotification($item, $request, $typeText, $routePath);

        return response()->json([
            'status' => 'success',
            'message' => "Pengajuan {$typeText} berhasil di-{$request->status}.",
            'data' => $item,
        ]);
    }

    private function determineLegacyTargetStatus($item, Request $request, User $user, bool $isCompanyAdmin, bool $isGlobalAdmin): string
    {
        if ($request->type === 'fund_request') {
            return $this->updateLegacyFundRequest($item, $request, $user, $isCompanyAdmin, $isGlobalAdmin);
        }

        if ($request->type === 'attendance_correction') {
            return $this->updateLegacyAttendanceCorrection($item, $request, $user);
        }

        $targetStatus = ($request->type === 'vehicle_log')
            ? $this->resolveLegacyVehicleLogStatus($item, $request->status)
            : $request->status;

        $previousStatus = $item->status;
        $item->update([
            'status' => $targetStatus,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

        if ($request->type === 'leave') {
            $this->handleLegacyLeaveDeductionOrRefund($targetStatus, $previousStatus);
        }

        return $targetStatus;
    }

    private function updateLegacyAttendanceCorrection($item, Request $request, User $user): string
    {
        $item->update([
            'status' => $request->status,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

        if ($request->status === 'approved') {
            $this->applyAttendanceCorrectionToRecord($item);
        }

        return $request->status;
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

    private function resolveLegacyVehicleLogStatus($item, string $status): string
    {
        if ($status === 'approved') {
            return ($item->status === 'pending') ? 'approved' : 'validated';
        }
        return 'rejected';
    }

    private function handleLegacyLeaveDeductionOrRefund(string $targetStatus, ?string $previousStatus): void
    {
        if ($targetStatus === 'approved' && $previousStatus !== 'approved') {
            LeaveController::processLeaveApprovalDeduction();
        } elseif ($targetStatus === 'rejected' && $previousStatus === 'approved') {
            LeaveController::processLeaveApprovalRefund();
        }
    }

    private function updateLegacyFundRequest($item, Request $request, User $user, bool $isCompanyAdmin, bool $isGlobalAdmin): string
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
}
