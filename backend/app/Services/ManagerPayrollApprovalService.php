<?php

namespace App\Services;

use App\Models\PayrollBatch;
use App\Models\Salary;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManagerPayrollApprovalService
{
    use Notifiable;

    private const ROUTE_PAYROLL_APPROVAL = '/dashboard/payroll/approval';

    public function handlePayrollApproval(Request $request, User $user, bool $isGlobalAdmin): JsonResponse
    {
        $batch = PayrollBatch::with(['creator', 'company'])
            ->where('id', $request->id)
            ->when(! $isGlobalAdmin, fn ($q) => $q->where('company_id', $user->company_id))
            ->firstOrFail();

        $submitter = $batch->creator ?: $user;
        $companyId = $batch->company_id ?: $user->company_id;

        if ($batch->current_approval_step !== null) {
            return $this->handleWorkflowPayrollApproval($batch, $request, $user, $companyId, $submitter);
        }

        return $this->handleDirectPayrollApproval($batch, $request, $user);
    }

    private function handleWorkflowPayrollApproval($batch, Request $request, User $user, int $companyId, $submitter): JsonResponse
    {
        $action = $request->status === 'approved' ? 'approve' : 'reject';
        $result = ApprovalService::processApproval(
            'payroll',
            $companyId,
            $user,
            $submitter,
            $batch->current_approval_step,
            $action
        );

        if ($result && isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 403);
        }

        if ($result && $result['is_final']) {
            return $this->handleFinalPayrollStep($batch, $result, $request, $user, $companyId);
        }

        return $this->handleIntermediatePayrollStep($batch, $result);
    }

    private function handleFinalPayrollStep($batch, array $result, Request $request, User $user, int $companyId): JsonResponse
    {
        $isApproved = $result['status'] === 'approved';
        $batchStatus = $isApproved ? 'approved' : 'rejected';
        $batch->update([
            'status' => $batchStatus,
            'current_approval_step' => null,
            'approved_by' => $isApproved ? $user->id : null,
            'approved_at' => $isApproved ? now() : null,
            'rejection_note' => $isApproved ? null : ($request->remark ?? 'Ditolak oleh approver'),
        ]);
        Salary::where('batch_id', $batch->id)->update(['status' => $batchStatus]);

        $statusLabel = $isApproved ? 'DISETUJUI' : 'DITOLAK';
        $this->notifySuperAdmins(
            $companyId,
            "BATCH PAYROLL {$statusLabel}",
            "Batch payroll periode {$batch->period_month} {$batch->period_year} telah {$statusLabel} oleh {$user->name}.".($request->remark ? " Catatan: {$request->remark}" : ''),
            $isApproved ? 'success' : 'danger',
            self::ROUTE_PAYROLL_APPROVAL,
            $user->id
        );

        return response()->json([
            'status' => 'success',
            'message' => $isApproved ? 'Batch payroll berhasil disetujui sepenuhnya.' : 'Batch payroll berhasil ditolak.',
            'data' => $batch->fresh(),
        ]);
    }

    private function handleIntermediatePayrollStep($batch, ?array $result): JsonResponse
    {
        $step = $result['current_approval_step'] ?? 1;
        $batch->update([
            'status' => 'pending_approval',
            'current_approval_step' => $step,
        ]);

        if (isset($result['approvers'])) {
            foreach ($result['approvers'] as $nextApprover) {
                $this->notify(
                    $nextApprover,
                    'PERSETUJUAN PAYROLL TAHAP BERIKUTNYA',
                    "Batch payroll periode {$batch->period_month} {$batch->period_year} siap untuk tahap persetujuan Anda ({$result['step_label']}).",
                    'info',
                    self::ROUTE_PAYROLL_APPROVAL
                );
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Persetujuan tahap {$batch->current_approval_step} berhasil. Berlanjut ke tahap berikutnya.",
            'data' => $batch->fresh(),
        ]);
    }

    private function handleDirectPayrollApproval($batch, Request $request, User $user): JsonResponse
    {
        $isApproved = $request->status === 'approved';

        $batch->update([
            'status' => $request->status,
            'approved_by' => $isApproved ? $user->id : null,
            'approved_at' => $isApproved ? now() : null,
            'rejection_note' => $isApproved ? null : ($request->remark ?? 'Ditolak oleh atasan/approver'),
        ]);

        Salary::where('batch_id', $batch->id)->update(['status' => $request->status]);

        $statusLabel = $isApproved ? 'DISETUJUI' : 'DITOLAK';
        $this->notifySuperAdmins(
            $batch->company_id ?? $user->company_id,
            "BATCH PAYROLL {$statusLabel}",
            "Batch payroll periode {$batch->period_month} {$batch->period_year} telah {$statusLabel} oleh {$user->name}.".($request->remark ? " Catatan: {$request->remark}" : ''),
            $isApproved ? 'success' : 'danger',
            self::ROUTE_PAYROLL_APPROVAL,
            $user->id
        );

        return response()->json([
            'status' => 'success',
            'message' => $isApproved ? 'Batch payroll berhasil disetujui.' : 'Batch payroll berhasil ditolak untuk revisi.',
            'data' => $batch->fresh(),
        ]);
    }
}
