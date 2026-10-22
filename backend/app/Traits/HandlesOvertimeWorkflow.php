<?php

namespace App\Traits;

use App\Models\ActivityLog;
use App\Models\Overtime;
use App\Models\User;
use App\Services\ApprovalService;
use App\Services\EmployeeQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait HandlesOvertimeWorkflow
{
    private function handleWorkflowDecision(Request $request, Overtime $overtime, string $decision)
    {
        $user = $request->user();
        $result = ApprovalService::processApproval(
            'overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, $decision
        );

        $errorResponse = $this->checkWorkflowResultError($result);
        if ($errorResponse !== null) {
            return $errorResponse;
        }

        return ($decision === 'reject')
            ? $this->applyWorkflowRejection($request, $overtime, $user)
            : $this->applyWorkflowApproval($request, $overtime, $user, $result);
    }

    private function checkWorkflowResultError(?array $result)
    {
        if ($result === null) {
            return $this->errorResponse('Workflow tidak ditemukan.', 400);
        }
        if (isset($result['error'])) {
            return $this->errorResponse($result['error'], 403);
        }

        return null;
    }

    private function applyWorkflowRejection(Request $request, Overtime $overtime, $user)
    {
        $overtime->update([
            'status' => 'rejected',
            'current_approval_step' => null,
            'approved_by' => $user->id,
            'remark' => $request->remark,
        ]);

        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => 'OVERTIME_REJECTION',
            'description' => "Menolak lembur {$overtime->user->name}",
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        $this->notify($overtime->user, 'LEMBUR DITOLAK', 'Mohon maaf, permohonan lembur Anda telah DITOLAK.', 'danger');

        $this->notifySuperAdmins(
            $overtime->company_id,
            'PENGAJUAN LEMBUR DITOLAK',
            "Pengajuan lembur {$overtime->user->name} (".($overtime->title ?? '-').") telah DITOLAK oleh {$user->name}.".($request->remark ? " Catatan: {$request->remark}" : ''),
            'danger',
            self::ROUTE_APPROVALS,
            $user->id
        );

        return $this->successResponse($overtime, 'Permohonan lembur ditolak.');
    }

    private function applyWorkflowApproval(Request $request, Overtime $overtime, $user, array $result)
    {
        $updateData = [
            'status' => $result['status'],
            'current_approval_step' => $result['current_approval_step'],
        ];

        if ($result['is_final'] && $result['status'] === 'approved') {
            $updateData['approved_by'] = $user->id;
            $updateData['remark'] = $request->remark;
        }

        $overtime->update($updateData);

        ActivityLog::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'action' => 'OVERTIME_APPROVAL',
            'description' => "Menyetujui lembur {$overtime->user->name}",
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        if ($result['is_final'] && $result['status'] === 'approved') {
            $this->notify($overtime->user, 'LEMBUR DISETUJUI', 'Permohonan lembur Anda telah DISETUJUI.', 'success');

            $this->notifySuperAdmins(
                $overtime->company_id,
                'PENGAJUAN LEMBUR DISETUJUI',
                "Pengajuan lembur {$overtime->user->name} (".($overtime->title ?? '-').") telah DISETUJUI oleh {$user->name}.",
                'success',
                self::ROUTE_APPROVALS,
                $user->id
            );

            return $this->successResponse($overtime, 'Permohonan lembur disetujui.');
        }

        if (isset($result['approvers'])) {
            foreach ($result['approvers'] as $nextApprover) {
                $this->notify($nextApprover, 'LEMBUR MENUNGGU PERSETUJUAN', "Pengajuan lembur {$overtime->user->name} menunggu persetujuan Anda. Tahap: {$result['step_label']}.", 'warning', self::ROUTE_APPROVALS);
            }
        }
        $this->notify($overtime->user, 'LEMBUR DALAM PROSES', "Pengajuan lembur Anda disetujui di tahap sebelumnya. Menunggu: {$result['step_label']}.", 'info');

        $this->notifySuperAdmins(
            $overtime->company_id,
            'PROGRESS PERSETUJUAN LEMBUR',
            "Pengajuan lembur {$overtime->user->name} (".($overtime->title ?? '-').") telah disetujui di tahap sebelumnya oleh {$user->name}. Menunggu: {$result['step_label']}.",
            'info',
            self::ROUTE_APPROVALS,
            $user->id
        );

        return $this->successResponse($overtime, "Di-approve. Menunggu: {$result['step_label']}.");
    }

    /**
     * Handle fallback approve/reject when no dynamic workflow is configured.
     */
    private function handleFallbackDecision(Request $request, Overtime $overtime, string $decision): JsonResponse
    {
        $this->authorizeFallbackDecision($request->user(), $overtime);

        $isApproval = $decision === 'approve';
        $status = $isApproval ? 'approved' : 'rejected';
        $action = $isApproval ? 'OVERTIME_APPROVAL' : 'OVERTIME_REJECTION';
        $actionLabel = $isApproval ? 'Menyetujui' : 'Menolak';
        $notifTitle = $isApproval ? 'LEMBUR DISETUJUI' : 'LEMBUR DITOLAK';
        $notifMsg = $isApproval
            ? 'Permohonan lembur Anda telah DISETUJUI oleh Admin.'
            : 'Mohon maaf, permohonan lembur Anda telah DITOLAK.';
        $notifType = $isApproval ? 'success' : 'danger';
        $responseMsg = $isApproval ? 'Permohonan lembur disetujui.' : 'Permohonan lembur ditolak.';

        $overtime->update([
            'status' => $status,
            'approved_by' => $request->user()->id,
            'remark' => $request->remark,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'company_id' => $request->user()->company_id,
            'action' => $action,
            'description' => "$actionLabel lembur {$overtime->user->name}",
            'model_type' => self::MODEL_OVERTIME,
            'model_id' => $overtime->id,
        ]);

        $this->notify($overtime->user, $notifTitle, $notifMsg, $notifType);

        $this->notifySuperAdmins(
            $overtime->company_id,
            $isApproval ? 'PENGAJUAN LEMBUR DISETUJUI' : 'PENGAJUAN LEMBUR DITOLAK',
            "Pengajuan lembur {$overtime->user->name} (".($overtime->title ?? '-').') telah '.($isApproval ? 'DISETUJUI' : 'DITOLAK')." oleh {$request->user()->name}.".($request->remark ? " Catatan: {$request->remark}" : ''),
            $notifType,
            self::ROUTE_APPROVALS,
            $request->user()->id
        );

        return $this->successResponse($overtime, $responseMsg);
    }

    private function handleOvertimeWorkflowNotification(User $user, int $companyId): bool
    {
        $workflowResult = ApprovalService::initApproval('overtime', $companyId, $user);

        if ($workflowResult) {
            if (! empty($workflowResult['auto_approved'])) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, 'Permohonan lembur Anda telah DISETUJUI OTOMATIS karena alur persetujuan dinonaktifkan.', 'success');

                return true;
            }

            if (isset($workflowResult['approvers'])) {
                $this->notify($user, self::NOTIFICATION_OVERTIME_SUCCESS, "Permohonan lembur Anda telah diajukan. Menunggu: {$workflowResult['step_label']}.", 'info');
                foreach ($workflowResult['approvers'] as $approver) {
                    $this->notify($approver, 'PENGAJUAN LEMBUR PERLU PERSETUJUAN', "{$user->name} telah mengajukan lembur. Mohon segera tinjau.", 'warning', self::ROUTE_APPROVALS);
                }

                return true;
            }
        }

        return false;
    }

    private function authorizeFallbackDecision(User $user, Overtime $overtime): void
    {
        $isSuperAdmin = $user->isSuperAdmin() || $user->role_id === 1 || $user->canAccessAllCompanies();
        if (! $isSuperAdmin) {
            $subordinateIds = EmployeeQueryService::resolveSubordinateIds($user->id);
            if (! in_array($overtime->user_id, $subordinateIds) && $overtime->assigned_by !== $user->id) {
                abort(403, 'Akses ditolak. Anda tidak memiliki izin untuk memproses lembur karyawan ini.');
            }
        }
        abort_if(! $user->hasPermission('approve-overtimes') && ! $isSuperAdmin, 403, self::MSG_FORBIDDEN);
    }
}
