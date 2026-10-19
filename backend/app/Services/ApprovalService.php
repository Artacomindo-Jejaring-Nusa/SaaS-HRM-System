<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowStep;
use App\Traits\ResolvesWorkflowApprovers;
use Illuminate\Support\Collection;

class ApprovalService
{
    use ResolvesWorkflowApprovers;
    /**
     * List of supported module keys for the dashboard.
     */
    public const MODULE_KEYS = [
        'leave' => 'Cuti',
        'permit' => 'Izin/Perizinan',
        'overtime' => 'Lembur',
        'reimbursement' => 'Reimbursement',
        'fund_request' => 'Pengajuan Dana',
        'attendance_correction' => 'Koreksi Absen',
        'shift_swap' => 'Tukar Shift',
        'task' => 'Pemberian & Verifikasi Tugas',
        'vehicle_log' => 'Peminjaman Kendaraan',
        'payroll' => 'Penggajian (Payroll)',
    ];

    public const CAT_ATTENDANCE = 'Kehadiran & Waktu';

    /**
     * Catalog of actual HRMS system features that can have approval workflows.
     */
    public const SYSTEM_MODULES = [
        'leave' => [
            'name' => 'Cuti Karyawan',
            'category' => self::CAT_ATTENDANCE,
            'icon' => 'Calendar',
            'description' => 'Pengajuan cuti tahunan, melahirkan, atau cuti khusus.',
            'default_layers' => 2,
        ],
        'permit' => [
            'name' => 'Perizinan',
            'category' => self::CAT_ATTENDANCE,
            'icon' => 'ClipboardList',
            'description' => 'Izin sakit, izin terlambat, pulang cepat, atau dinas luar.',
            'default_layers' => 1,
        ],
        'overtime' => [
            'name' => 'Lembur (Overtime)',
            'category' => self::CAT_ATTENDANCE,
            'icon' => 'Clock',
            'description' => 'Surat perintah dan pengajuan jam kerja lembur.',
            'default_layers' => 1,
        ],
        'reimbursement' => [
            'name' => 'Klaim Biaya (Reimbursement)',
            'category' => 'Keuangan',
            'icon' => 'CreditCard',
            'description' => 'Klaim biaya operasional, medis, atau perjalanan dinas.',
            'default_layers' => 2,
        ],
        'fund_request' => [
            'name' => 'Pengajuan Dana (Fund Request)',
            'category' => 'Keuangan',
            'icon' => 'Wallet',
            'description' => 'Permintaan kas bon operasional atau dana kerja proyek.',
            'default_layers' => 2,
        ],
        'attendance_correction' => [
            'name' => 'Koreksi Absensi',
            'category' => self::CAT_ATTENDANCE,
            'icon' => 'CheckSquare',
            'description' => 'Perbaikan data jam kehadiran yang terlewat atau keliru.',
            'default_layers' => 1,
        ],
        'shift_swap' => [
            'name' => 'Tukar Shift',
            'category' => 'Operasional',
            'icon' => 'Repeat',
            'description' => 'Pertukaran jadwal shift kerja dengan persetujuan atasan.',
            'default_layers' => 2,
        ],
        'task' => [
            'name' => 'Pemberian & Verifikasi Tugas',
            'category' => 'Tugas & Proyek',
            'icon' => 'CheckCircle2',
            'description' => 'Validasi penugasan baru dan verifikasi bukti penyelesaian tugas karyawan.',
            'default_layers' => 1,
        ],
        'vehicle_log' => [
            'name' => 'Peminjaman Kendaraan Dinas',
            'category' => 'Operasional',
            'icon' => 'Car',
            'description' => 'Persetujuan penggunaan armada kendaraan dinas operasional.',
            'default_layers' => 1,
        ],
        'payroll' => [
            'name' => 'Penggajian (Payroll)',
            'category' => 'Keuangan',
            'icon' => 'DollarSign',
            'description' => 'Persetujuan berjenjang atas batch penggajian (payroll) sebelum pembayaran transfer gaji.',
            'default_layers' => 2,
        ],
    ];

    /**
     * Get the active workflow for a specific module, company, and submitter.
     * Evaluates hierarchical priority:
     * 1. User-specific workflow (scope_type = 'user', scope_id = submitter.id)
     * 2. Role/Division-specific workflow (scope_type = 'role', scope_id = submitter.role_id)
     * 3. Company default workflow (scope_type = 'company' or null)
     */
    public static function getWorkflow(string $moduleKey, int $companyId, ?User $submitter = null): ?ApprovalWorkflow
    {
        if ($submitter) {
            // 1. Check user-specific workflow
            $userWorkflow = ApprovalWorkflow::with(['steps.role', 'steps.approverUser'])
                ->where('company_id', $companyId)
                ->where('module_key', $moduleKey)
                ->where('scope_type', 'user')
                ->where('scope_id', $submitter->id)
                ->where('is_active', true)
                ->first();

            if ($userWorkflow) {
                return $userWorkflow;
            }

            // 2. Check role / division specific workflow
            if ($submitter->role_id) {
                $roleWorkflow = ApprovalWorkflow::with(['steps.role', 'steps.approverUser'])
                    ->where('company_id', $companyId)
                    ->where('module_key', $moduleKey)
                    ->where('scope_type', 'role')
                    ->where('scope_id', $submitter->role_id)
                    ->where('is_active', true)
                    ->first();

                if ($roleWorkflow) {
                    return $roleWorkflow;
                }
            }
        }

        // 3. Fallback to company-wide default workflow
        return ApprovalWorkflow::with(['steps.role', 'steps.approverUser'])
            ->where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->where(function ($q) {
                $q->where('scope_type', 'company')
                    ->orWhereNull('scope_type');
            })
            ->where('is_active', true)
            ->first();
    }

    /**
     * Check if the workflow for this module, company, and submitter is explicitly deactivated (disabled).
     */
    public static function isWorkflowDisabled(string $moduleKey, int $companyId, ?User $submitter = null): bool
    {
        if (self::getWorkflow($moduleKey, $companyId, $submitter) !== null) {
            return false;
        }

        $workflow = self::findRelevantWorkflow($moduleKey, $companyId, $submitter);

        return $workflow ? ! $workflow->is_active : false;
    }

    private static function findRelevantWorkflow(string $moduleKey, int $companyId, ?User $submitter): ?ApprovalWorkflow
    {
        $query = ApprovalWorkflow::where('company_id', $companyId)
            ->where('module_key', $moduleKey);

        if ($submitter) {
            $userScoped = (clone $query)->where('scope_type', 'user')->where('scope_id', $submitter->id)->first();
            if ($userScoped) {
                return $userScoped;
            }

            if ($submitter->role_id) {
                $roleScoped = (clone $query)->where('scope_type', 'role')->where('scope_id', $submitter->role_id)->first();
                if ($roleScoped) {
                    return $roleScoped;
                }
            }
        }

        return (clone $query)->where(function ($q) {
            $q->where('scope_type', 'company')->orWhereNull('scope_type');
        })->first();
    }

    /**
     * Initialize the approval process when a request is first submitted.
     *
     * @return array|null Returns approval info or null to use default/fallback logic.
     *                    - 'status': The initial status string to set
     *                    - 'current_approval_step': The step number to start on
     *                    - 'approvers': Collection of User models who should be notified
     *                    - 'auto_approved': Boolean indicating if the request was auto-approved
     */
    public static function initApproval(string $moduleKey, int $companyId, User $submitter): ?array
    {
        // 1. If workflow is explicitly turned off / disabled, auto-approve immediately!
        if (self::isWorkflowDisabled($moduleKey, $companyId, $submitter)) {
            return self::autoApprovedResponse();
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);

        if (! $workflow) {
            return null; // No dynamic workflow → fallback to default hardcoded logic
        }

        return self::resolveInitialWorkflowStep($workflow, $submitter, $companyId);
    }

    private static function autoApprovedResponse(): array
    {
        return [
            'status' => 'approved',
            'current_approval_step' => null,
            'approvers' => collect(),
            'step_label' => 'Disetujui Otomatis',
            'auto_approved' => true,
        ];
    }

    private static function resolveInitialWorkflowStep(ApprovalWorkflow $workflow, User $submitter, int $companyId): array
    {
        $firstStep = $workflow->steps()->orderBy('step_number')->first();

        if (! $firstStep) {
            return self::autoApprovedResponse();
        }

        return [
            'status' => 'pending',
            'current_approval_step' => $firstStep->step_number,
            'approvers' => self::getApproversForStep($firstStep, $submitter, $companyId),
            'step_label' => self::getStepLabel($firstStep),
            'auto_approved' => false,
        ];
    }

    /**
     * Process an approve or reject action on the current step.
     *
     * @param  string  $action  'approve' or 'reject'
     * @return array|null Returns result info or null for fallback.
     *                    - 'status': New status ('pending', 'approved', or 'rejected')
     *                    - 'current_approval_step': Next step number (null if final)
     *                    - 'is_final': Whether this was the last step
     *                    - 'approved_by': The approver's user ID (on final approval)
     *                    - 'approvers': Next step approvers (if not final)
     *                    - 'error': Error message if authorization fails
     */
    public static function processApproval(
        string $moduleKey,
        int $companyId,
        User $approver,
        User $submitter,
        ?int $currentStep,
        string $action
    ): ?array {
        if ($currentStep === null) {
            return null; // Fallback to default logic
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);
        if (! $workflow) {
            return null; // Fallback
        }

        return self::executeApprovalStep($workflow, $currentStep, $approver, $submitter, $action, $companyId);
    }

    /**
     * Check if the given user can approve/reject the current step of a request.
     * This is a public-facing method for controllers that need to check authorization.
     */
    public static function canApprove(
        string $moduleKey,
        int $companyId,
        User $approver,
        User $submitter,
        ?int $currentStep
    ): bool {
        if ($currentStep === null) {
            return false;
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);
        $step = $workflow?->steps()->where('step_number', $currentStep)->first();

        return $step ? self::canUserApproveStep($step, $approver, $submitter, $moduleKey) : false;
    }

    public const ROLE_SUPER_ADMIN = 'Super Admin';

    /**
     * Get the list of users who can approve a specific workflow step.
     */
    public static function getApproversForStep(WorkflowStep $step, User $submitter, int $companyId): Collection
    {
        return match ($step->approver_type) {
            'super_admin' => self::getSuperAdminApprovers($companyId, $submitter->id),
            'supervisor' => self::getSupervisorApprovers($submitter, $companyId),
            'role' => self::getRoleApprovers($step, $submitter, $companyId),
            'user' => self::getUserApprovers($step),
            default => collect(),
        };
    }

    /**
     * Get a human-readable label for a step (for notifications).
     */
    public static function getStepLabel(WorkflowStep $step): string
    {
        return match ($step->approver_type) {
            'super_admin' => 'Approved by - Disetujui ('.self::ROLE_SUPER_ADMIN.')',
            'supervisor' => 'Checked by - Diperiksa (Atasan Langsung)',
            'role' => ($step->step_number === 2)
                ? 'Acknowledge - Diketahui (' . ($step->role?->name ?? 'Management') . ')'
                : 'Approved by - Disetujui (' . ($step->role?->name ?? 'Management') . ')',
            'user' => $step->approver_user_id
                ? 'Approved by - Disetujui (' . (User::find($step->approver_user_id)?->name ?? 'User') . ')'
                : 'Approved by - Disetujui (User)',
            default => "Tahap {$step->step_number}",
        };
    }

    /**
     * Get the complete multi-step approval timeline for a request.
     * Useful for Super Admins, Managers, and Employees to see exactly which stage the request is currently at.
     */
    public static function getApprovalTimeline(
        string $moduleKey,
        int $companyId,
        User $submitter,
        ?int $currentStep,
        string $status,
        ?string $remark = null
    ): array {
        return ApprovalTimelineService::getApprovalTimeline(
            $moduleKey,
            $companyId,
            $submitter,
            $currentStep,
            $status,
            $remark
        );
    }

    /**
     * Get the current step info for display purposes (e.g., in API response).
     */
    public static function getCurrentStepInfo(string $moduleKey, ?int $companyId, ?int $currentStep, ?User $submitter = null): ?array
    {
        if (empty($companyId) || empty($currentStep)) {
            return null;
        }

        return ApprovalTimelineService::getCurrentStepInfo($moduleKey, (int) $companyId, $currentStep, $submitter);
    }

    // ─── Private Helpers ───────────────────────────────────

    /**
     * Get the permission slug associated with a workflow module.
     */
    public static function getApprovalPermissionForModule(string $moduleKey): ?string
    {
        return match ($moduleKey) {
            'overtime' => 'approve-overtimes',
            'leave' => 'approve-leaves',
            'permit' => 'approve-permits',
            'reimbursement' => 'approve-reimbursements',
            'fund_request' => 'approve-fund-requests',
            'shift_swap' => 'approve-shift-swaps',
            'attendance_correction' => 'approve-attendances',
            'task' => 'manage-tasks',
            'vehicle_log' => 'approve-vehicle-logs',
            'payroll' => 'approve-payroll',
            default => null,
        };
    }

    private static function canApproveRoleStep(WorkflowStep $step, User $approver, User $submitter): bool
    {
        if ($approver->role_id !== $step->approver_role_id) {
            return false;
        }

        $role = $step->role ?? $approver->role;
        $roleName = $role ? strtolower($role->name) : '';
        if (in_array($roleName, ['supervisor', 'spv', 'manager'])) {
            $subordinates = EmployeeQueryService::resolveSubordinateIds($approver->id);

            return $submitter->supervisor_id === $approver->id || in_array($submitter->id, $subordinates);
        }

        return true;
    }

    private static function canApproveUserStep(WorkflowStep $step, User $approver): bool
    {
        return $approver->id === $step->approver_user_id;
    }

    private static function canApproveSupervisorStep(User $approver, User $submitter): bool
    {
        if ($submitter->supervisor_id === $approver->id) {
            return true;
        }

        $subordinates = EmployeeQueryService::resolveSubordinateIds($approver->id);

        return in_array($submitter->id, $subordinates);
    }

    /**
     * Check if a specific user can act on a specific workflow step.
     */
    private static function canUserApproveStep(WorkflowStep $step, User $approver, User $submitter): bool
    {
        $isSuperAdmin = $approver->role_id === 1
            || (method_exists($approver, 'isSuperAdmin') && $approver->isSuperAdmin())
            || (method_exists($approver, 'canAccessAllCompanies') && $approver->canAccessAllCompanies());

        // Approver cannot approve their own submission unless Super Admin
        if ($approver->id === $submitter->id && ! $isSuperAdmin) {
            return false;
        }

        // Super Admin memiliki wewenang override / persetujuan darurat di tahap mana pun
        if ($isSuperAdmin) {
            return true;
        }

        return match ($step->approver_type) {
            'super_admin' => ($approver->role?->name === self::ROLE_SUPER_ADMIN),
            'supervisor' => self::canApproveSupervisorStep($approver, $submitter),
            'role' => self::canApproveRoleStep($step, $approver, $submitter),
            'user' => self::canApproveUserStep($step, $approver),
            default => false,
        };
    }
}
