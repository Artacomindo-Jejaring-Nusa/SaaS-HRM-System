<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApprovalWorkflowController extends Controller
{
    private function resolveCompanyId(Request $request): ?int
    {
        $user = $request->user();
        if (($user->role_id === 1 || $user->canAccessAllCompanies()) && $request->filled('company_id')) {
            return (int) $request->company_id;
        }
        return $user->company_id;
    }

    public function index(Request $request)
    {
        $companyId = $this->resolveCompanyId($request);

        $workflows = ApprovalWorkflow::with(['steps.role', 'steps.approverUser'])
            ->where('company_id', $companyId)
            ->get();

        return $this->successResponse($workflows, 'Workflows retrieved successfully.');
    }

    public function show(Request $request, $moduleKey)
    {
        $companyId = $this->resolveCompanyId($request);

        $workflow = ApprovalWorkflow::with(['steps.role', 'steps.approverUser'])
            ->where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->first();

        if (! $workflow) {
            return $this->successResponse(null, 'No custom workflow set. Using default hardcoded hierarchy.');
        }

        return $this->successResponse($workflow, 'Workflow retrieved successfully.');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $user->loadMissing('role');
        $roleName = $user->role ? $user->role->name : '';

        $isAuthorized = $user->role_id === 1 ||
            in_array($roleName, ['Super Admin', 'Admin', 'HRD Manager', 'HRD Staff', 'Management']) ||
            str_contains(strtolower($roleName), 'hrd') ||
            str_contains(strtolower($roleName), 'admin');

        if (! $isAuthorized) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang dapat mengubah alur persetujuan.', 403);
        }

        $request->validate([
            'company_id' => 'nullable|integer|exists:companies,id',
            'module_key' => 'required|string|in:'.implode(',', array_keys(ApprovalService::MODULE_KEYS)),
            'name' => 'required|string|max:100',
            'is_active' => 'required|boolean',
            'flow_json' => 'nullable|string',
            'steps' => 'required|array|min:1',
            'steps.*.step_number' => 'required|integer|min:1',
            'steps.*.approver_type' => 'required|string|in:supervisor,role,user',
            'steps.*.approver_role_id' => 'nullable|integer|exists:roles,id',
            'steps.*.approver_user_id' => 'nullable|integer|exists:users,id',
            'steps.*.sla_hours' => 'nullable|integer|min:1',
        ]);

        $companyId = $this->resolveCompanyId($request);

        $workflow = DB::transaction(function () use ($request, $companyId) {
            $workflow = ApprovalWorkflow::updateOrCreate(
                [
                    'company_id' => $companyId,
                    'module_key' => $request->module_key,
                ],
                [
                    'name' => $request->name,
                    'is_active' => $request->is_active,
                    'flow_json' => $request->flow_json,
                ]
            );

            // Delete old steps and recreate
            $workflow->steps()->delete();

            foreach ($request->steps as $stepData) {
                $workflow->steps()->create([
                    'step_number' => $stepData['step_number'],
                    'approver_type' => $stepData['approver_type'],
                    'approver_role_id' => $stepData['approver_type'] === 'role' ? ($stepData['approver_role_id'] ?? null) : null,
                    'approver_user_id' => $stepData['approver_type'] === 'user' ? ($stepData['approver_user_id'] ?? null) : null,
                    'sla_hours' => $stepData['sla_hours'] ?? 24,
                ]);
            }

            return $workflow->load(['steps.role', 'steps.approverUser']);
        });

        $this->logActivity('UPDATE_WORKFLOW', "Updated approval workflow for module: {$request->module_key} (Company: {$companyId})");

        return $this->successResponse($workflow, 'Workflow saved successfully.');
    }

    /**
     * Get list of available module keys with labels.
     */
    public function getModuleKeys()
    {
        $modules = collect(ApprovalService::MODULE_KEYS)->map(function ($label, $key) {
            return ['key' => $key, 'label' => $label];
        })->values();

        return $this->successResponse($modules, 'Module keys retrieved successfully.');
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
