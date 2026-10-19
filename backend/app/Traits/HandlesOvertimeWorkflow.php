<?php

namespace App\Traits;

use App\Models\ActivityLog;
use App\Models\Overtime;
use App\Services\ApprovalService;
use Illuminate\Http\Request;

trait HandlesOvertimeWorkflow
{
    private function handleWorkflowDecision(Request $request, Overtime $overtime, string $decision)
    {
        $user = $request->user();
        $result = ApprovalService::processApproval(
            'overtime', $overtime->company_id, $user, $overtime->user, $overtime->current_approval_step, $decision
        );

        if ($result === null) {
            return $this->errorResponse('Workflow tidak ditemukan.', 400);
        }
        if (isset($result['error'])) {
            return $this->errorResponse($result['error'], 403);
        }

        if ($decision === 'reject') {
            return $this->applyWorkflowRejection($request, $overtime, $user);
        }

        return $this->applyWorkflowApproval($request, $overtime, $user, $result);
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
}
