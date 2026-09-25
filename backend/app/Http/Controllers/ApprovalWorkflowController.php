<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Models\Task;
use App\Models\Leave;
use App\Models\Overtime;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\FundRequest;
use App\Models\AttendanceCorrection;
use App\Services\ApprovalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use App\Traits\HandlesApprovalWorkflowHelpers;

class ApprovalWorkflowController extends Controller
{
    use HandlesApprovalWorkflowHelpers;

    public function index(Request $request)
    {
        $companyId = $this->resolveCompanyId($request);

        $workflows = ApprovalWorkflow::with(['steps.role', 'steps.approverUser', 'scopeRole', 'scopeUser'])
            ->where('company_id', $companyId)
            ->get();

        return $this->successResponse($workflows, 'Workflows retrieved successfully.');
    }

    public function show(Request $request, $idOrModuleKey)
    {
        $companyId = $this->resolveCompanyId($request);

        $query = ApprovalWorkflow::with(['steps.role', 'steps.approverUser', 'scopeRole', 'scopeUser'])
            ->where('company_id', $companyId);

        if (is_numeric($idOrModuleKey)) {
            $workflow = $query->where('id', $idOrModuleKey)->first();
        } else {
            if ($request->has('workflow_id') && !empty($request->workflow_id)) {
                $workflow = (clone $query)->where('id', $request->workflow_id)->first();
            } else {
                $workflow = (clone $query)->where('module_key', $idOrModuleKey)
                    ->orderByRaw("CASE WHEN scope_type = 'company' OR scope_type IS NULL THEN 0 ELSE 1 END")
                    ->first();
            }
        }

        if (! $workflow) {
            return $this->successResponse(null, 'No custom workflow set. Using default hardcoded hierarchy.');
        }

        return $this->successResponse($workflow, 'Workflow retrieved successfully.');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang dapat mengubah alur persetujuan.', 403);
        }

        $request->validate([
            'id' => 'nullable|integer|exists:approval_workflows,id',
            'company_id' => 'nullable|integer|exists:companies,id',
            'module_key' => 'required|string|regex:/^[a-z0-9_]+$/|max:50',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'is_custom' => 'nullable|boolean',
            'is_active' => 'required|boolean',
            'flow_json' => 'nullable|string',
            'scope_type' => 'nullable|string|in:company,role,user',
            'scope_id' => 'nullable|integer',
            'steps' => 'required|array|min:1',
            'steps.*.step_number' => 'required|integer|min:1',
            'steps.*.approver_type' => 'required|string|in:supervisor,role,user',
            'steps.*.approver_role_id' => 'nullable|integer|exists:roles,id',
            'steps.*.approver_user_id' => 'nullable|integer|exists:users,id',
            'steps.*.sla_hours' => 'nullable|integer|min:1',
        ]);

        $companyId = $this->resolveCompanyId($request);

        $workflow = DB::transaction(function () use ($request, $companyId) {
            if ($request->filled('id')) {
                $workflow = ApprovalWorkflow::where('company_id', $companyId)->findOrFail($request->id);
                $workflow->update([
                    'name' => $request->name,
                    'description' => $request->description,
                    'icon' => $request->icon ?? $workflow->icon,
                    'category' => $request->category ?? $workflow->category,
                    'is_active' => $request->is_active,
                    'is_custom' => $request->boolean('is_custom', $workflow->is_custom),
                    'flow_json' => $request->flow_json,
                    'scope_type' => $request->scope_type ?? $workflow->scope_type,
                    'scope_id' => $request->scope_id ?? $workflow->scope_id,
                    'priority' => $this->getScopePriority($request->scope_type),
                ]);
            } else {
                $scopeType = $request->scope_type ?? 'company';
                $workflow = ApprovalWorkflow::updateOrCreate(
                    [
                        'company_id' => $companyId,
                        'module_key' => $request->module_key,
                        'scope_type' => $scopeType,
                        'scope_id' => $request->scope_id,
                    ],
                    [
                        'name' => $request->name,
                        'description' => $request->description,
                        'icon' => $request->icon ?? 'GitBranch',
                        'category' => $request->category ?? 'operasional',
                        'is_active' => $request->is_active,
                        'is_custom' => $request->boolean('is_custom', false),
                        'flow_json' => $request->flow_json,
                        'priority' => $this->getScopePriority($scopeType),
                    ]
                );
            }

            // Delete old steps and recreate
            $workflow->steps()->delete();
            $this->createWorkflowSteps($workflow, $request->steps);

            return $workflow->load(['steps.role', 'steps.approverUser', 'scopeRole', 'scopeUser']);
        });

        $this->logActivity('UPDATE_WORKFLOW', "Updated approval workflow ID {$workflow->id} for module: {$request->module_key} (Company: {$companyId})");

        return $this->successResponse($workflow, 'Workflow saved successfully.');
    }

    /**
     * Create a new custom workflow (Super Admin only).
     */
    public function createCustomModule(Request $request)
    {
        $user = $request->user();
        if (! $this->isSuperAdmin($user)) {
            return $this->errorResponse('Hanya Super Admin yang berhak menambahkan alur persetujuan baru.', 403);
        }

        $request->validate([
            'name' => 'required|string|max:100',
            'module_key' => 'nullable|string|regex:/^[a-z0-9_]+$/|max:50',
            'description' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:50',
            'company_id' => 'nullable|integer|exists:companies,id',
            'steps' => 'nullable|array',
        ]);

        $companyId = $this->resolveCompanyId($request);
        $moduleKey = $request->module_key ?: Str::slug($request->name, '_');

        // Check if workflow already exists for this company
        $existing = ApprovalWorkflow::where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->first();

        if ($existing) {
            return $this->errorResponse("Alur dengan modul '{$moduleKey}' sudah ada di perusahaan ini.", 422);
        }

        $workflow = DB::transaction(function () use ($request, $companyId, $moduleKey) {
            $workflow = ApprovalWorkflow::create([
                'company_id' => $companyId,
                'module_key' => $moduleKey,
                'name' => $request->name,
                'description' => $request->description ?? 'Alur persetujuan kustom yang dikonfigurasi Super Admin.',
                'icon' => $request->icon ?? 'CheckCircle2',
                'category' => $request->category ?? 'Tugas & Proyek',
                'is_active' => true,
                'is_custom' => true,
            ]);

            $this->createWorkflowSteps($workflow, $request->input('steps'));

            return $workflow->load(['steps.role', 'steps.approverUser']);
        });

        $this->logActivity('CREATE_CUSTOM_WORKFLOW', "Created new custom workflow: {$workflow->name} ({$moduleKey})");

        return $this->successResponse($workflow, 'Alur persetujuan baru berhasil ditambahkan.', 201);
    }

    /**
     * Delete a custom workflow (Super Admin only).
     */
    public function destroyCustomModule(Request $request, $moduleKey)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya Super Admin dan HRD yang berhak mengelola alur persetujuan.', 403);
        }

        $companyId = $this->resolveCompanyId($request);

        $workflow = ApprovalWorkflow::where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->first();

        if (! $workflow) {
            return $this->errorResponse('Alur persetujuan tidak ditemukan.', 404);
        }

        if (! $workflow->is_custom && array_key_exists($moduleKey, ApprovalService::SYSTEM_MODULES)) {
            // Cannot delete built-in system modules, but can deactivate
            $workflow->update(['is_active' => false]);
            $msg = 'Alur sistem inti dinonaktifkan (tidak dapat dihapus permanen).';
        } else {
            $workflow->steps()->delete();
            $workflow->delete();
            $this->logActivity('DELETE_CUSTOM_WORKFLOW', "Deleted workflow: {$moduleKey} (Company: {$companyId})");
            $msg = 'Alur persetujuan berhasil dihapus.';
        }

        return $this->successResponse(null, $msg);
    }

    /**
     * Duplicate an existing workflow to create a scoped variant (by role/division or user).
     */
    public function duplicateWorkflow(Request $request)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang dapat menduplikasi alur persetujuan.', 403);
        }

        $request->validate([
            'source_workflow_id' => 'required|integer|exists:approval_workflows,id',
            'name' => 'nullable|string|max:100',
            'scope_type' => 'required|in:company,role,user',
            'scope_id' => 'nullable|integer',
            'company_id' => 'nullable|integer|exists:companies,id',
        ]);

        $companyId = $this->resolveCompanyId($request);
        $source = ApprovalWorkflow::with('steps')->findOrFail($request->source_workflow_id);

        $rawName = $request->filled('name') ? trim($request->name) : $source->name;
        $existingNames = ApprovalWorkflow::where('company_id', $companyId)
            ->where('module_key', $source->module_key)
            ->pluck('name')
            ->toArray();

        $finalName = $this->resolveDuplicateFinalName($rawName, $source->name, $existingNames);

        $newWorkflow = DB::transaction(function () use ($request, $source, $companyId, $finalName) {
            $priority = $this->getScopePriority($request->scope_type);

            $duplicate = ApprovalWorkflow::create([
                'company_id' => $companyId,
                'module_key' => $source->module_key,
                'name' => $finalName,
                'description' => $source->description ?? "Alur spesifik untuk {$finalName}",
                'icon' => $source->icon ?? 'GitBranch',
                'category' => $source->category ?? 'operasional',
                'is_active' => true,
                'is_custom' => true,
                'flow_json' => $source->flow_json,
                'scope_type' => $request->scope_type,
                'scope_id' => $request->scope_id,
                'priority' => $priority,
            ]);

            foreach ($source->steps as $step) {
                $duplicate->steps()->create([
                    'step_number' => $step->step_number,
                    'approver_type' => $step->approver_type,
                    'approver_role_id' => $step->approver_role_id,
                    'approver_user_id' => $step->approver_user_id,
                    'sla_hours' => $step->sla_hours ?? 24,
                ]);
            }

            return $duplicate->load(['steps.role', 'steps.approverUser', 'scopeRole', 'scopeUser']);
        });

        $this->logActivity('DUPLICATE_WORKFLOW', "Duplicated workflow {$source->id} -> {$newWorkflow->id} ({$newWorkflow->name}) (Company: {$companyId})");

        return $this->successResponse($newWorkflow, 'Alur persetujuan berhasil diduplikasi.');
    }

    /**
     * Toggle active status of a workflow or variant.
     */
    public function toggleActive(Request $request, $id)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang berhak mengubah status alur persetujuan.', 403);
        }

        $companyId = $this->resolveCompanyId($request);
        $workflow = ApprovalWorkflow::where('company_id', $companyId)->findOrFail($id);

        $workflow->update([
            'is_active' => ! $workflow->is_active,
        ]);

        $statusStr = $workflow->is_active ? 'diaktifkan' : 'dinonaktifkan';
        $this->logActivity('TOGGLE_WORKFLOW_STATUS', "Alur persetujuan '{$workflow->name}' (ID: {$workflow->id}) {$statusStr}");

        return $this->successResponse($workflow, "Alur persetujuan '{$workflow->name}' berhasil {$statusStr}.");
    }

    /**
     * Toggle active status by module key (creates default workflow if none exists yet).
     */
    public function toggleModuleActive(Request $request, $moduleKey)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang berhak mengubah status alur persetujuan.', 403);
        }

        $companyId = $this->resolveCompanyId($request);
        $workflow = ApprovalWorkflow::where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->where(function ($q) {
                $q->where('scope_type', 'company')->orWhereNull('scope_type');
            })
            ->first();

        if (! $workflow) {
            if (! array_key_exists($moduleKey, ApprovalService::SYSTEM_MODULES)) {
                return $this->errorResponse("Modul '{$moduleKey}' tidak dikenal.", 404);
            }
            $meta = ApprovalService::SYSTEM_MODULES[$moduleKey];
            $workflow = ApprovalWorkflow::create([
                'company_id' => $companyId,
                'module_key' => $moduleKey,
                'name' => $meta['name'],
                'description' => $meta['description'] ?? '',
                'icon' => $meta['icon'] ?? 'GitBranch',
                'category' => $meta['category'] ?? 'operasional',
                'is_active' => false,
                'is_custom' => false,
                'scope_type' => 'company',
                'priority' => 0,
            ]);

            $workflow->steps()->create([
                'step_number' => 1,
                'approver_type' => 'supervisor',
                'sla_hours' => 24,
            ]);
        } else {
            $workflow->update([
                'is_active' => ! $workflow->is_active,
            ]);
        }

        $statusStr = $workflow->is_active ? 'diaktifkan' : 'dinonaktifkan';
        $this->logActivity('TOGGLE_WORKFLOW_STATUS', "Alur persetujuan '{$workflow->name}' {$statusStr}");

        return $this->successResponse($workflow, "Alur persetujuan '{$workflow->name}' berhasil {$statusStr}.");
    }

    /**
     * Delete a specific scoped workflow variant.
     */
    public function destroyVariant(Request $request, $id)
    {
        $user = $request->user();
        if (! $this->isAuthorizedUser($user)) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang berhak menghapus alur persetujuan.', 403);
        }

        $workflow = ApprovalWorkflow::findOrFail($id);

        // Security check: non-super-admin can only delete workflows belonging to their company
        if (! $this->isSuperAdmin($user) && $workflow->company_id !== $user->company_id) {
            return $this->errorResponse('Tidak memiliki izin menghapus alur persetujuan ini.', 403);
        }

        // If it's the only workflow for a system module and is default company scope, don't delete permanently; deactivate instead
        $count = ApprovalWorkflow::where('company_id', $workflow->company_id)
            ->where('module_key', $workflow->module_key)
            ->count();
        if ($count <= 1 && ($workflow->scope_type === 'company' || empty($workflow->scope_type)) && array_key_exists($workflow->module_key, ApprovalService::SYSTEM_MODULES)) {
            $workflow->update(['is_active' => false]);
            $msg = 'Alur default dinonaktifkan (karena merupakan alur utama fitur).';
        } else {
            $workflow->steps()->delete();
            $workflow->delete();
            $this->logActivity('DELETE_WORKFLOW_VARIANT', "Deleted workflow variant ID {$id}: {$workflow->name}");
            $msg = 'Varian alur persetujuan berhasil dihapus.';
        }

        return $this->successResponse(null, $msg);
    }

    /**
     * Get list of all available modules with real HRMS catalog metadata and scoped variants.
     */
    public function getModuleKeys(Request $request)
    {
        $companyId = $this->resolveCompanyId($request);

        // Fetch all workflows for this company, grouped by module_key
        $configuredWorkflows = ApprovalWorkflow::with(['steps.role', 'steps.approverUser', 'scopeRole', 'scopeUser'])
            ->where('company_id', $companyId)
            ->orderBy('priority', 'asc')
            ->orderBy('id', 'asc')
            ->get()
            ->groupBy('module_key');

        $resultModules = collect();

        // 1. Process standard System Modules (from ApprovalService::SYSTEM_MODULES)
        foreach (ApprovalService::SYSTEM_MODULES as $key => $meta) {
            $resultModules->push($this->mapSystemModuleItem($key, $meta, $configuredWorkflows));
        }

        // 2. Process Custom Modules added previously (if any exist)
        foreach ($configuredWorkflows as $key => $variants) {
            if (! array_key_exists($key, ApprovalService::SYSTEM_MODULES)) {
                $resultModules->push($this->mapCustomModuleItem($key, $variants));
            }
        }

        // 3. Catalog of selectable HRMS features to activate
        $availableSystemCatalog = collect(ApprovalService::SYSTEM_MODULES)->map(function ($meta, $key) {
            return [
                'key' => $key,
                'name' => $meta['name'],
                'category' => $meta['category'],
                'icon' => $meta['icon'],
                'description' => $meta['description'],
                'default_layers' => $meta['default_layers'],
            ];
        })->values();

        return $this->successResponse([
            'modules' => $resultModules->values(),
            'system_catalog' => $availableSystemCatalog,
        ], 'Module keys retrieved successfully.');
    }

    /**
     * Super Admin God Mode: Force-approve or Force-reject ANY pending item in the system.
     */
    public function godModeOverride(Request $request)
    {
        $user = $request->user();
        if (! $this->isSuperAdmin($user)) {
            return $this->errorResponse('Akses ditolak. Fitur God Mode Override hanya untuk Super Admin.', 403);
        }

        $request->validate([
            'module_key' => 'required|string',
            'target_id' => 'required|integer',
            'action' => 'required|in:approve,reject',
            'reason' => 'nullable|string|max:500',
        ]);

        $action = $request->action;
        $status = $action === 'approve' ? 'approved' : 'rejected';
        $reason = $request->reason ?: 'Disetujui via Super Admin God Mode Override';

        switch ($request->module_key) {
            case 'task':
                $item = Task::findOrFail($request->target_id);
                $item->update([
                    'status' => $action === 'approve' ? 'ongoing' : 'cancelled',
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'leave':
                $item = Leave::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'overtime':
                $item = Overtime::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'permit':
                $item = Permit::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'reimbursement':
                $item = Reimbursement::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'fund_request':
                $item = FundRequest::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            case 'attendance_correction':
                $item = AttendanceCorrection::findOrFail($request->target_id);
                $item->update([
                    'status' => $status,
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);
                break;

            default:
                return $this->errorResponse("Modul '{$request->module_key}' belum mendukung override instan.", 400);
        }

        $this->logActivity('GOD_MODE_OVERRIDE', "Super Admin force-{$action} on {$request->module_key} #{$request->target_id}. Alasan: {$reason}");

        return $this->successResponse($item, "Pengajuan {$request->module_key} berhasil di-{$action} langsung oleh Super Admin.");
    }

    /**
     * Get list of companies (for Super Admin selector).
     */
    public function getCompanies(Request $request)
    {
        $user = $request->user();
        if ($user->role_id === 1 || $user->canAccessAllCompanies()) {
            $companies = Company::select('id', 'name')->orderBy('name')->get();
        } else {
            $companies = Company::where('id', $user->company_id)->select('id', 'name')->get();
        }

        return $this->successResponse($companies, 'Companies retrieved successfully.');
    }

    /**
     * Get list of all roles (for dropdown in UI).
     */
    public function getRoles(Request $request)
    {
        $roles = Role::orderBy('name')->get();

        return $this->successResponse($roles, 'Roles retrieved successfully.');
    }

    /**
     * Get list of users in the company (for 'user' type approver).
     */
    public function getUsers(Request $request)
    {
        $companyId = $this->resolveCompanyId($request);

        $users = User::where('company_id', $companyId)
            ->select('id', 'name', 'email', 'role_id')
            ->with('role:id,name')
            ->orderBy('name')
            ->get();

        return $this->successResponse($users, 'Users retrieved successfully.');
    }
}
