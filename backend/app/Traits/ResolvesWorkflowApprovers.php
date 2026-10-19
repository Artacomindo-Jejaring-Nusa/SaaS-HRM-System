<?php

namespace App\Traits;

use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowStep;
use App\Services\EmployeeQueryService;
use Illuminate\Support\Collection;

trait ResolvesWorkflowApprovers
{
    private static function executeApprovalStep(
        ApprovalWorkflow $workflow,
        int $currentStep,
        User $approver,
        User $submitter,
        string $action,
        int $companyId
    ): array {
        $step = $workflow->steps()->where('step_number', $currentStep)->first();
        $error = self::validateApprovalAuthorization($step, $approver, $submitter);
        if ($error !== null) {
            return ['error' => $error];
        }

        if ($action === 'reject') {
            return [
                'status' => 'rejected',
                'current_approval_step' => null,
                'is_final' => true,
                'approved_by' => $approver->id,
            ];
        }

        return self::resolveNextApprovalStep($workflow, $currentStep, $approver, $submitter, $companyId);
    }

    private static function validateApprovalAuthorization(?WorkflowStep $step, User $approver, User $submitter): ?string
    {
        if (! $step) {
            return 'Tahap persetujuan tidak ditemukan dalam workflow.';
        }
        if (! self::canUserApproveStep($step, $approver, $submitter)) {
            return 'Anda tidak memiliki wewenang untuk menyetujui/menolak pada tahap ini.';
        }

        return null;
    }

    private static function resolveNextApprovalStep(
        ApprovalWorkflow $workflow,
        int $currentStep,
        User $approver,
        User $submitter,
        int $companyId
    ): array {
        $nextStep = $workflow->steps()
            ->where('step_number', '>', $currentStep)
            ->orderBy('step_number')
            ->first();

        if (! $nextStep) {
            return [
                'status' => 'approved',
                'current_approval_step' => null,
                'is_final' => true,
                'approved_by' => $approver->id,
            ];
        }

        return [
            'status' => 'pending',
            'current_approval_step' => $nextStep->step_number,
            'is_final' => false,
            'approvers' => self::getApproversForStep($nextStep, $submitter, $companyId),
            'step_label' => self::getStepLabel($nextStep),
        ];
    }

    private static function getSuperAdminApprovers(int $companyId, int $excludeUserId): Collection
    {
        return User::where(function ($q) {
            $q->where('role_id', 1)
                ->orWhereHas('role', function ($r) {
                    $r->where('name', self::ROLE_SUPER_ADMIN);
                });
        })
            ->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)
                    ->orWhereNull('company_id');
            })
            ->where('id', '!=', $excludeUserId)
            ->get();
    }

    private static function getSupervisorApprovers(User $submitter, int $companyId): Collection
    {
        if ($submitter->supervisor_id) {
            $supervisor = User::find($submitter->supervisor_id);

            return $supervisor ? collect([$supervisor]) : collect();
        }

        return self::getSuperAdminApprovers($companyId, $submitter->id);
    }

    private static function getRoleApprovers(WorkflowStep $step, User $submitter, int $companyId): Collection
    {
        if (! $step->approver_role_id) {
            return collect();
        }

        $roleUsers = User::with('role')->where(function ($q) use ($companyId) {
            $q->where('company_id', $companyId)
                ->orWhereNull('company_id');
        })
            ->where('role_id', $step->approver_role_id)
            ->where('id', '!=', $submitter->id)
            ->get();

        $roleName = strtolower($step->role?->name ?? '');
        if (in_array($roleName, ['supervisor', 'spv', 'manager'])) {
            $roleUsers = $roleUsers->filter(function ($u) use ($submitter) {
                if ($submitter->supervisor_id === $u->id) {
                    return true;
                }
                $subs = EmployeeQueryService::resolveSubordinateIds($u->id);

                return in_array($submitter->id, $subs);
            })->values();
        }

        return $roleUsers;
    }

    private static function getUserApprovers(WorkflowStep $step): Collection
    {
        if (! $step->approver_user_id) {
            return collect();
        }

        $user = User::find($step->approver_user_id);

        return $user ? collect([$user]) : collect();
    }
}
