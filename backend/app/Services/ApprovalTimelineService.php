<?php

namespace App\Services;

use App\Models\User;
use App\Models\WorkflowStep;

class ApprovalTimelineService
{
    public static function getApprovalTimeline(
        string $moduleKey,
        int $companyId,
        User $submitter,
        ?int $currentStep,
        string $status,
        ?string $remark = null
    ): array {
        $workflow = ApprovalService::getWorkflow($moduleKey, $companyId, $submitter);

        if (! $workflow || $workflow->steps->isEmpty()) {
            return self::buildDefaultTimeline($submitter, $status, $remark);
        }

        $allSteps = $workflow->steps()->orderBy('step_number')->get();
        $totalSteps = $allSteps->count();
        $activeStepNumber = $currentStep ?? 1;

        $timelineSteps = [];
        foreach ($allSteps as $st) {
            $approverCandidates = self::resolveApproverCandidates($st, $submitter, $companyId);
            [$stepStatus, $isCurrent] = self::calculateStepStatus($status, $st->step_number, $activeStepNumber);

            $timelineSteps[] = [
                'step_number' => $st->step_number,
                'name' => ApprovalService::getStepLabel($st),
                'label' => ApprovalService::getStepLabel($st),
                'approver_type' => $st->approver_type,
                'approver_candidates' => $approverCandidates,
                'status' => $stepStatus,
                'is_current' => $isCurrent,
                'sla_hours' => $st->sla_hours,
                'remark' => $isCurrent ? $remark : null,
            ];
        }

        $currentStepObj = $allSteps->where('step_number', $activeStepNumber)->first();
        $currentLabel = $currentStepObj ? ApprovalService::getStepLabel($currentStepObj) : "Tahap {$activeStepNumber}";

        return [
            'has_workflow' => true,
            'workflow_id' => $workflow->id,
            'workflow_name' => $workflow->name,
            'current_step' => $activeStepNumber,
            'total_steps' => $totalSteps,
            'status' => $status,
            'current_step_label' => self::formatCurrentStepLabel($status, $currentLabel, $activeStepNumber, $totalSteps),
            'steps' => $timelineSteps,
        ];
    }

    public static function getCurrentStepInfo(string $moduleKey, int $companyId, ?int $currentStep, ?User $submitter = null): ?array
    {
        if ($currentStep === null) {
            return null;
        }

        $workflow = ApprovalService::getWorkflow($moduleKey, $companyId, $submitter);
        $step = $workflow?->steps()->where('step_number', $currentStep)->first();
        if (!$step) {
            return null;
        }

        $totalSteps = $workflow->steps()->count();

        return [
            'step_number' => $step->step_number,
            'total_steps' => $totalSteps,
            'label' => ApprovalService::getStepLabel($step),
            'approver_type' => $step->approver_type,
            'sla_hours' => $step->sla_hours,
        ];
    }

    private static function buildDefaultTimeline(User $submitter, string $status, ?string $remark): array
    {
        $approverName = 'Atasan Langsung / HRD';
        if ($submitter->supervisor_id) {
            $spv = User::find($submitter->supervisor_id);
            if ($spv) {
                $approverName = $spv->name . ' (Atasan Langsung)';
            }
        }

        $stepStatus = match ($status) {
            'approved' => 'approved',
            'rejected' => 'rejected',
            default => 'pending',
        };

        return [
            'has_workflow' => false,
            'workflow_name' => 'Alur Persetujuan Standar',
            'current_step' => 1,
            'total_steps' => 1,
            'status' => $status,
            'current_step_label' => 'Tahap 1: ' . $approverName,
            'steps' => [
                [
                    'step_number' => 1,
                    'name' => 'Persetujuan Atasan / HRD',
                    'label' => 'Otorisasi ' . $approverName,
                    'approver_type' => 'supervisor',
                    'approver_candidates' => [$approverName],
                    'status' => $stepStatus,
                    'is_current' => $stepStatus === 'pending',
                    'remark' => $remark,
                ]
            ],
        ];
    }

    private static function resolveApproverCandidates(WorkflowStep $st, User $submitter, int $companyId): array
    {
        $approverCandidates = [];
        $approverUsers = ApprovalService::getApproversForStep($st, $submitter, $companyId);
        foreach ($approverUsers as $u) {
            $approverCandidates[] = $u->name . ($u->role ? ' (' . $u->role->name . ')' : '');
        }

        if (empty($approverCandidates)) {
            if ($st->approver_type === 'super_admin') {
                $approverCandidates[] = ApprovalService::ROLE_SUPER_ADMIN;
            } elseif ($st->approver_type === 'supervisor') {
                $approverCandidates[] = 'Atasan Langsung';
            } elseif ($st->role) {
                $approverCandidates[] = $st->role->name;
            }
        }

        return $approverCandidates;
    }

    private static function calculateStepStatus(string $status, int $stepNumber, int $activeStepNumber): array
    {
        $stepStatus = 'waiting';
        $isCurrent = false;

        if ($status === 'approved' || $stepNumber < $activeStepNumber) {
            $stepStatus = 'approved';
        } elseif ($stepNumber === $activeStepNumber) {
            $stepStatus = $status === 'rejected' ? 'rejected' : 'pending';
            $isCurrent = true;
        } elseif ($status === 'rejected') {
            $stepStatus = 'cancelled';
        }

        return [$stepStatus, $isCurrent];
    }

    private static function formatCurrentStepLabel(string $status, string $currentLabel, int $activeStepNumber, int $totalSteps): string
    {
        if ($status === 'approved') {
            return 'Disetujui Sepenuhnya';
        }
        if ($status === 'rejected') {
            return 'Ditolak pada ' . $currentLabel;
        }

        return "Tahap {$activeStepNumber} dari {$totalSteps}: {$currentLabel}";
    }
}
