<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowStep;
use Illuminate\Support\Collection;

class ApprovalService
{
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
        'performance_review' => 'Evaluasi Kinerja',
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
        'performance_review' => [
            'name' => 'Evaluasi Kinerja (KPI Review)',
            'category' => 'SDM & Karir',
            'icon' => 'Award',
            'description' => 'Persetujuan berjenjang atas hasil penilaian performa kerja.',
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
     * Initialize the approval process when a request is first submitted.
     *
     * @return array|null Returns approval info or null to use default/fallback logic.
     *   - 'status': The initial status string to set
     *   - 'current_approval_step': The step number to start on
     *   - 'approvers': Collection of User models who should be notified
     */
    public static function initApproval(string $moduleKey, int $companyId, User $submitter): ?array
    {
        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);

        if (! $workflow) {
            return null; // No dynamic workflow → fallback to default hardcoded logic
        }

        $firstStep = $workflow->steps()->orderBy('step_number')->first();

        if (! $firstStep) {
            return null; // Workflow exists but has no steps → fallback
        }

        $approvers = self::getApproversForStep($firstStep, $submitter, $companyId);

        return [
            'status' => 'pending',
            'current_approval_step' => $firstStep->step_number,
            'approvers' => $approvers,
            'step_label' => self::getStepLabel($firstStep),
        ];
    }

    /**
     * Process an approve or reject action on the current step.
     *
     * @param  string  $action  'approve' or 'reject'
     * @return array|null Returns result info or null for fallback.
     *   - 'status': New status ('pending', 'approved', or 'rejected')
     *   - 'current_approval_step': Next step number (null if final)
     *   - 'is_final': Whether this was the last step
     *   - 'approved_by': The approver's user ID (on final approval)
     *   - 'approvers': Next step approvers (if not final)
     *   - 'error': Error message if authorization fails
     */
    public static function processApproval(
        string $moduleKey,
        int $companyId,
        User $approver,
        User $submitter,
        ?int $currentStep,
        string $action
    ): ?array {
        // If current_approval_step is null, there's no dynamic workflow active
        if ($currentStep === null) {
            return null; // Fallback to default logic
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);

        if (! $workflow) {
            return null; // Fallback
        }

        // Find the current step definition
        $step = $workflow->steps()->where('step_number', $currentStep)->first();

        if (! $step) {
            return ['error' => 'Tahap persetujuan tidak ditemukan dalam workflow.'];
        }

        // Validate that this user is authorized to act on this step
        if (! self::canUserApproveStep($step, $approver, $submitter, $companyId, $moduleKey)) {
            return ['error' => 'Anda tidak memiliki wewenang untuk menyetujui/menolak pada tahap ini.'];
        }

        // Handle rejection → immediately reject, no further steps
        if ($action === 'reject') {
            return [
                'status' => 'rejected',
                'current_approval_step' => null,
                'is_final' => true,
                'approved_by' => $approver->id,
            ];
        }

        // Handle approval → check if there's a next step
        $nextStep = $workflow->steps()
            ->where('step_number', '>', $currentStep)
            ->orderBy('step_number')
            ->first();

        if (! $nextStep) {
            // This was the final step → fully approved
            return [
                'status' => 'approved',
                'current_approval_step' => null,
                'is_final' => true,
                'approved_by' => $approver->id,
            ];
        }

        // Move to the next step
        $nextApprovers = self::getApproversForStep($nextStep, $submitter, $companyId);

        return [
            'status' => 'pending',
            'current_approval_step' => $nextStep->step_number,
            'is_final' => false,
            'approvers' => $nextApprovers,
            'step_label' => self::getStepLabel($nextStep),
        ];
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
            return false; // Not using dynamic workflow
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);
        if (! $workflow) {
            return false;
        }

        $step = $workflow->steps()->where('step_number', $currentStep)->first();
        if (! $step) {
            return false;
        }

        return self::canUserApproveStep($step, $approver, $submitter, $companyId, $moduleKey);
    }

    /**
     * Get the list of users who can approve a specific workflow step.
     */
    public static function getApproversForStep(WorkflowStep $step, User $submitter, int $companyId): Collection
    {
        switch ($step->approver_type) {
            case 'super_admin':
                // All Super Admins
                return User::where(function ($q) use ($companyId) {
                        $q->where('role_id', 1)
                            ->orWhereHas('role', function ($r) {
                                $r->where('name', 'Super Admin');
                            });
                    })
                    ->where(function ($q) use ($companyId) {
                        $q->where('company_id', $companyId)
                            ->orWhereNull('company_id');
                    })
                    ->where('id', '!=', $submitter->id)
                    ->get();

            case 'supervisor':
                // The direct supervisor of the submitter
                if ($submitter->supervisor_id) {
                    $supervisor = User::find($submitter->supervisor_id);
                    return $supervisor ? collect([$supervisor]) : collect();
                }
                // Fallback when submitter has no supervisor: find users with module approval permission
                $moduleKey = $step->workflow->module_key ?? '';
                $permission = self::getApprovalPermissionForModule($moduleKey);
                if ($permission) {
                    return User::where('company_id', $companyId)
                        ->where('id', '!=', $submitter->id)
                        ->get()
                        ->filter(fn ($u) => $u->hasPermission($permission))
                        ->values();
                }
                return collect();

            case 'role':
                // All users in the same company with the specified role
                if (! $step->approver_role_id) {
                    return collect();
                }
                return User::where('company_id', $companyId)
                    ->where('role_id', $step->approver_role_id)
                    ->where('id', '!=', $submitter->id) // Don't include the submitter
                    ->get();

            case 'user':
                // A specific user
                if (! $step->approver_user_id) {
                    return collect();
                }
                $user = User::find($step->approver_user_id);
                return $user ? collect([$user]) : collect();

            default:
                return collect();
        }
    }

    /**
     * Get a human-readable label for a step (for notifications).
     */
    public static function getStepLabel(WorkflowStep $step): string
    {
        switch ($step->approver_type) {
            case 'super_admin':
                return 'Approved by - Disetujui (Super Admin)';
            case 'supervisor':
                return 'Checked by - Diperiksa (Atasan Langsung)';
            case 'role':
                $roleName = $step->role ? $step->role->name : 'Management';
                if ($step->step_number === 2) {
                    return "Acknowledge - Diketahui ({$roleName})";
                }
                return "Approved by - Disetujui ({$roleName})";
            case 'user':
                if ($step->approver_user_id) {
                    $user = User::find($step->approver_user_id);
                    return $user ? "Approved by - Disetujui ({$user->name})" : 'Approved by - Disetujui (User)';
                }
                return 'Approved by - Disetujui (User)';
            default:
                return "Tahap {$step->step_number}";
        }
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
        ?int $approvedById = null,
        ?string $remark = null
    ): array {
        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);

        if (! $workflow || $workflow->steps->isEmpty()) {
            $approverName = 'Atasan Langsung / HRD';
            if ($submitter->supervisor_id) {
                $spv = User::find($submitter->supervisor_id);
                if ($spv) $approverName = $spv->name . ' (Atasan Langsung)';
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

        $allSteps = $workflow->steps()->orderBy('step_number')->get();
        $totalSteps = $allSteps->count();
        $activeStepNumber = $currentStep ?? 1;

        $timelineSteps = [];

        foreach ($allSteps as $st) {
            $approverCandidates = [];
            $approverUsers = self::getApproversForStep($st, $submitter, $companyId);
            foreach ($approverUsers as $u) {
                $approverCandidates[] = $u->name . ($u->role ? ' (' . $u->role->name . ')' : '');
            }
            if (empty($approverCandidates)) {
                if ($st->approver_type === 'super_admin') {
                    $approverCandidates[] = 'Super Admin';
                } elseif ($st->approver_type === 'supervisor') {
                    $approverCandidates[] = 'Atasan Langsung';
                } elseif ($st->role) {
                    $approverCandidates[] = $st->role->name;
                }
            }

            // Determine status of this step
            $stepStatus = 'waiting';
            $isCurrent = false;

            if ($status === 'approved') {
                $stepStatus = 'approved';
            } elseif ($status === 'rejected') {
                if ($st->step_number < $activeStepNumber) {
                    $stepStatus = 'approved';
                } elseif ($st->step_number === $activeStepNumber) {
                    $stepStatus = 'rejected';
                    $isCurrent = true;
                } else {
                    $stepStatus = 'cancelled';
                }
            } else {
                // Pending status
                if ($st->step_number < $activeStepNumber) {
                    $stepStatus = 'approved';
                } elseif ($st->step_number === $activeStepNumber) {
                    $stepStatus = 'pending';
                    $isCurrent = true;
                } else {
                    $stepStatus = 'waiting';
                }
            }

            $timelineSteps[] = [
                'step_number' => $st->step_number,
                'name' => self::getStepLabel($st),
                'label' => self::getStepLabel($st),
                'approver_type' => $st->approver_type,
                'approver_candidates' => $approverCandidates,
                'status' => $stepStatus,
                'is_current' => $isCurrent,
                'sla_hours' => $st->sla_hours,
                'remark' => $isCurrent ? $remark : null,
            ];
        }

        $currentStepObj = $allSteps->where('step_number', $activeStepNumber)->first();
        $currentLabel = $currentStepObj ? self::getStepLabel($currentStepObj) : "Tahap {$activeStepNumber}";

        return [
            'has_workflow' => true,
            'workflow_id' => $workflow->id,
            'workflow_name' => $workflow->name,
            'current_step' => $activeStepNumber,
            'total_steps' => $totalSteps,
            'status' => $status,
            'current_step_label' => $status === 'approved' ? 'Disetujui Sepenuhnya' : ($status === 'rejected' ? 'Ditolak pada ' . $currentLabel : "Tahap {$activeStepNumber} dari {$totalSteps}: {$currentLabel}"),
            'steps' => $timelineSteps,
        ];
    }

    /**
     * Get the current step info for display purposes (e.g., in API response).
     */
    public static function getCurrentStepInfo(string $moduleKey, int $companyId, ?int $currentStep, ?User $submitter = null): ?array
    {
        if ($currentStep === null) {
            return null;
        }

        $workflow = self::getWorkflow($moduleKey, $companyId, $submitter);
        $step = $workflow?->steps()->where('step_number', $currentStep)->first();
        if (!$step) {
            return null;
        }

        $totalSteps = $workflow->steps()->count();

        return [
            'step_number' => $step->step_number,
            'total_steps' => $totalSteps,
            'label' => self::getStepLabel($step),
            'approver_type' => $step->approver_type,
            'sla_hours' => $step->sla_hours,
        ];
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
            'performance_review' => 'manage-performance-reviews',
            default => null,
        };
    }



    private static function canApproveRoleStep(WorkflowStep $step, User $approver): bool
    {
        if ($approver->role_id === $step->approver_role_id) {
            return true;
        }

        if ($approver->role_id === 1) {
            return true;
        }

        return false;
    }

    private static function canApproveUserStep(WorkflowStep $step, User $approver): bool
    {
        return $approver->id === $step->approver_user_id || $approver->role_id === 1;
    }

    private static function canApproveSupervisorStep(User $approver, User $submitter, bool $hasModulePermission): bool
    {
        if ($submitter->supervisor_id) {
            return $submitter->supervisor_id === $approver->id;
        }

        return $approver->role_id === 1 || $hasModulePermission;
    }

    /**
     * Check if a specific user can act on a specific workflow step.
     */
    private static function canUserApproveStep(WorkflowStep $step, User $approver, User $submitter, int $companyId, ?string $moduleKey = null): bool
    {
        // Approver cannot approve their own submission
        if ($approver->id === $submitter->id) {
            return false;
        }

        // Must belong to the same company (or can access all companies)
        if ($approver->company_id !== $companyId && ! (method_exists($approver, 'canAccessAllCompanies') && $approver->canAccessAllCompanies())) {
            return false;
        }

        $resolvedModuleKey = $moduleKey ?: ($step->workflow->module_key ?? '');
        $permission = self::getApprovalPermissionForModule($resolvedModuleKey);
        $hasModulePermission = $permission ? $approver->hasPermission($permission) : false;

        return match ($step->approver_type) {
            'super_admin' => ($approver->role_id === 1 || $approver->role?->name === 'Super Admin' || (method_exists($approver, 'canAccessAllCompanies') && $approver->canAccessAllCompanies())),
            'supervisor' => self::canApproveSupervisorStep($approver, $submitter, $hasModulePermission),
            'role' => self::canApproveRoleStep($step, $approver),
            'user' => self::canApproveUserStep($step, $approver),
            default => false,
        };
    }
}
