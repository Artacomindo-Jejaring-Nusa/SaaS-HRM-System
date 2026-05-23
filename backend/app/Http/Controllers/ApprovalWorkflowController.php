<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\WorkflowStep;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApprovalWorkflowController extends Controller
{
    public function index(Request $request)
    {
        $companyId = $request->user()->company_id;
        
        $workflows = ApprovalWorkflow::with('steps.role')
            ->where('company_id', $companyId)
            ->get();

        return $this->successResponse($workflows, 'Workflows retrieved successfully.');
    }

    public function show(Request $request, $moduleKey)
    {
        $companyId = $request->user()->company_id;

        $workflow = ApprovalWorkflow::with('steps.role')
            ->where('company_id', $companyId)
            ->where('module_key', $moduleKey)
            ->first();

        if (!$workflow) {
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

        if (!$isAuthorized) {
            return $this->errorResponse('Hanya HRD dan Super Admin yang dapat mengubah alur persetujuan.', 403);
        }

        $request->validate([
            'module_key' => 'required|string',
            'name' => 'required|string|max:100',
            'is_active' => 'required|boolean',
            'flow_json' => 'nullable|string',
            'steps' => 'required|array',
            'steps.*.step_number' => 'required|integer',
            'steps.*.approver_type' => 'required|string|in:supervisor,role,user',
            'steps.*.approver_role_id' => 'nullable|integer|exists:roles,id',
            'steps.*.sla_hours' => 'nullable|integer',
        ]);

        $companyId = $request->user()->company_id;

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
                    'approver_role_id' => $stepData['approver_role_id'] ?? null,
                    'sla_hours' => $stepData['sla_hours'] ?? 24,
                ]);
            }

            return $workflow->load('steps.role');
        });

        $this->logActivity('UPDATE_WORKFLOW', "Updated approval workflow for module: {$request->module_key}");

        return $this->successResponse($workflow, 'Workflow saved successfully.');
    }

    public function getRoles(Request $request)
    {
        $roles = Role::orderBy('name')->get();
        return $this->successResponse($roles, 'Roles retrieved successfully.');
    }
}
