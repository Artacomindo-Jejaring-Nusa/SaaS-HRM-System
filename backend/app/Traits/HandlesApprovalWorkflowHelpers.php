<?php

namespace App\Traits;

use App\Models\ApprovalWorkflow;
use App\Models\User;
use Illuminate\Http\Request;

trait HandlesApprovalWorkflowHelpers
{
    private function resolveCompanyId(Request $request): ?int
    {
        $user = $request->user();
        if ($user && ($user->role_id === 1 || (method_exists($user, 'canAccessAllCompanies') && $user->canAccessAllCompanies())) && $request->filled('company_id')) {
            return (int) $request->company_id;
        }
        return $user ? $user->company_id : 1;
    }

    private function isSuperAdmin(User $user): bool
    {
        $user->loadMissing('role');
        return $user->role_id === 1 ||
            $user->role?->name === 'Super Admin' ||
            (method_exists($user, 'canAccessAllCompanies') && $user->canAccessAllCompanies());
    }

    private function isAuthorizedUser(User $user): bool
    {
        $user->loadMissing('role');
        $roleName = $user->role ? $user->role->name : '';

        return $this->isSuperAdmin($user) ||
            in_array($roleName, ['Super Admin', 'Admin', 'HRD Manager', 'HRD Staff', 'Management']) ||
            str_contains(strtolower($roleName), 'hrd') ||
            str_contains(strtolower($roleName), 'admin');
    }

    private function getScopePriority(?string $scopeType): int
    {
        if ($scopeType === 'user') {
            return 2;
        }
        if ($scopeType === 'role') {
            return 1;
        }
        return 0;
    }

    private function createWorkflowSteps(ApprovalWorkflow $workflow, ?array $stepsData): void
    {
        if (empty($stepsData)) {
            $workflow->steps()->create([
                'step_number' => 1,
                'approver_type' => 'supervisor',
                'sla_hours' => 24,
            ]);
            return;
        }

        foreach ($stepsData as $step) {
            $workflow->steps()->create([
                'step_number' => $step['step_number'],
                'approver_type' => $step['approver_type'],
                'approver_role_id' => $step['approver_type'] === 'role' ? ($step['approver_role_id'] ?? null) : null,
                'approver_user_id' => $step['approver_type'] === 'user' ? ($step['approver_user_id'] ?? null) : null,
                'sla_hours' => $step['sla_hours'] ?? 24,
            ]);
        }
    }

    private function resolveDuplicateFinalName(string $rawName, string $sourceName, array $existingNames): string
    {
        $baseName = preg_replace('/(\s*\(\s*Khusus\s*\)|-\d+)$/i', '', $rawName);
        if (empty($baseName)) {
            $baseName = $sourceName;
        }

        $maxNum = 1;
        foreach ($existingNames as $name) {
            if (preg_match('/^' . preg_quote($baseName, '/') . '-(\d+)$/i', trim($name), $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }
        $nextTag = $maxNum + 1;

        if ($rawName === $baseName || preg_match('/^' . preg_quote($baseName, '/') . '(-\d+)?$/i', $rawName) || str_contains($rawName, '(Khusus)')) {
            return "{$baseName}-{$nextTag}";
        }

        return in_array($rawName, $existingNames) ? "{$rawName}-{$nextTag}" : $rawName;
    }

    private function mapSystemModuleItem(string $key, array $meta, $configuredWorkflows): array
    {
        $variants = $configuredWorkflows->get($key, collect());
        $defaultVariant = $variants->first(fn ($w) => $w->scope_type === 'company' || empty($w->scope_type)) ?? $variants->first();

        $stepCount = $defaultVariant && $defaultVariant->steps->count() > 0
            ? $defaultVariant->steps->count()
            : ($meta['default_layers'] ?? 1);

        $mappedVariants = $variants->map(function ($wf) {
            $scopeLabel = 'Semua Karyawan (Default)';
            if ($wf->scope_type === 'role') {
                $scopeLabel = 'Divisi/Jabatan: ' . ($wf->scopeRole ? $wf->scopeRole->name : "Role #{$wf->scope_id}");
            } elseif ($wf->scope_type === 'user') {
                $scopeLabel = 'Karyawan: ' . ($wf->scopeUser ? $wf->scopeUser->name : "User #{$wf->scope_id}");
            }

            return [
                'id' => $wf->id,
                'name' => $wf->name,
                'scope_type' => $wf->scope_type ?? 'company',
                'scope_id' => $wf->scope_id,
                'scope_label' => $scopeLabel,
                'is_active' => $wf->is_active,
                'layers' => $wf->steps->count(),
                'is_default' => ($wf->scope_type === 'company' || empty($wf->scope_type)),
            ];
        })->values();

        return [
            'key' => $key,
            'label' => $meta['name'],
            'category' => $meta['category'] ?? 'Umum',
            'icon' => $meta['icon'] ?? 'GitBranch',
            'description' => $meta['description'] ?? '',
            'layers' => $stepCount,
            'is_custom' => false,
            'is_active' => $defaultVariant ? $defaultVariant->is_active : false,
            'is_configured' => $variants->isNotEmpty(),
            'active_workflow_id' => $defaultVariant ? $defaultVariant->id : null,
            'variants' => $mappedVariants,
        ];
    }

    private function mapCustomModuleItem(string $key, $variants): array
    {
        $first = $variants->first();
        return [
            'key' => $key,
            'label' => $first->name,
            'category' => $first->category ?? 'Kustom',
            'icon' => $first->icon ?? 'CheckCircle2',
            'description' => $first->description ?? 'Alur persetujuan kustom',
            'layers' => $first->steps->count() ?: 1,
            'is_custom' => true,
            'is_active' => $first->is_active,
            'is_configured' => true,
            'active_workflow_id' => $first->id,
            'variants' => $variants->map(fn ($wf) => [
                'id' => $wf->id,
                'name' => $wf->name,
                'scope_type' => $wf->scope_type ?? 'company',
                'scope_id' => $wf->scope_id,
                'scope_label' => 'Semua Karyawan (Default)',
                'is_active' => $wf->is_active,
                'layers' => $wf->steps->count(),
                'is_default' => true,
            ])->values(),
        ];
    }
}
