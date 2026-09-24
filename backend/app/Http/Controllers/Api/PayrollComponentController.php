<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ComponentTrigger;
use App\Models\EmployeeComponent;
use App\Models\PayrollComponent;
use App\Models\PayslipDetail;
use App\Models\Salary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayrollComponentController extends Controller
{
    /**
     * List all payroll components with triggers and assignment stats.
     */
    public function index(Request $request)
    {
        $companyId = $request->user()->company_id;

        $query = PayrollComponent::where('company_id', $companyId)
            ->with(['triggers', 'assignments.user:id,name,email', 'assignments.role:id,name']);

        if ($request->has('type') && in_array($request->type, ['earning', 'deduction'])) {
            $query->where('type', $request->type);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $components = $query->orderBy('type')->orderBy('name')->get();

        return response()->json([
            'status' => 'success',
            'data' => $components,
        ]);
    }

    /**
     * Create a new payroll component along with its triggers and assignments.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'type' => 'required|in:earning,deduction',
            'calculation_rule' => 'required|in:fixed,attendance,percentage,formula,adhoc',
            'default_amount' => 'nullable|numeric|min:0',
            'percentage_value' => 'nullable|numeric|min:0|max:100',
            'percentage_basis' => 'nullable|string|max:50',
            'formula_expression' => 'nullable|string|max:1000',
            'is_taxable' => 'boolean',
            'is_active' => 'boolean',
            'description' => 'nullable|string',

            // Triggers (array)
            'triggers' => 'nullable|array',
            'triggers.*.trigger_type' => 'required|in:recurring_monthly,fixed_calendar_date,date_range,employee_anniversary,manual',
            'triggers.*.config' => 'nullable|array',

            // Assignments
            'assignment_type' => 'required|in:global,role,users',
            'role_id' => 'nullable|exists:roles,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $companyId = $request->user()->company_id;

        DB::beginTransaction();
        try {
            $component = PayrollComponent::create([
                'company_id' => $companyId,
                'name' => $request->name,
                'code' => $request->code,
                'type' => $request->type,
                'calculation_rule' => $request->calculation_rule,
                'default_amount' => $request->default_amount ?? 0,
                'percentage_value' => $request->percentage_value,
                'percentage_basis' => $request->percentage_basis,
                'formula_expression' => $request->formula_expression,
                'is_taxable' => $request->boolean('is_taxable', true),
                'is_active' => $request->boolean('is_active', true),
                'description' => $request->description,
            ]);

            // Save triggers
            $triggersData = $request->triggers ?? [['trigger_type' => 'recurring_monthly']];
            foreach ($triggersData as $trig) {
                ComponentTrigger::create([
                    'component_id' => $component->id,
                    'trigger_type' => $trig['trigger_type'] ?? 'recurring_monthly',
                    'config' => $trig['config'] ?? null,
                ]);
            }

            // Save assignment
            $this->applyAssignments($component, $request);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Komponen gaji berhasil dibuat.',
                'data' => $component->fresh()->load(['triggers', 'assignments.user:id,name', 'assignments.role:id,name']),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membuat komponen gaji: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show single component detail.
     */
    public function show(Request $request, $id)
    {
        $component = PayrollComponent::where('company_id', $request->user()->company_id)
            ->with(['triggers', 'assignments.user:id,name,email', 'assignments.role:id,name'])
            ->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $component,
        ]);
    }

    /**
     * Update existing component, triggers, and assignments.
     */
    public function update(Request $request, $id)
    {
        $component = PayrollComponent::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
            'type' => 'sometimes|required|in:earning,deduction',
            'calculation_rule' => 'sometimes|required|in:fixed,attendance,percentage,formula,adhoc',
            'default_amount' => 'nullable|numeric|min:0',
            'percentage_value' => 'nullable|numeric|min:0|max:100',
            'percentage_basis' => 'nullable|string|max:50',
            'formula_expression' => 'nullable|string|max:1000',
            'is_taxable' => 'boolean',
            'is_active' => 'boolean',
            'description' => 'nullable|string',

            'triggers' => 'nullable|array',
            'triggers.*.trigger_type' => 'required|in:recurring_monthly,fixed_calendar_date,date_range,employee_anniversary,manual',
            'triggers.*.config' => 'nullable|array',

            'assignment_type' => 'nullable|in:global,role,users',
            'role_id' => 'nullable|exists:roles,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        DB::beginTransaction();
        try {
            $component->update($request->only([
                'name', 'code', 'type', 'calculation_rule', 'default_amount',
                'percentage_value', 'percentage_basis', 'formula_expression',
                'is_taxable', 'is_active', 'description',
            ]));

            // Update triggers if provided
            if ($request->has('triggers')) {
                $component->triggers()->delete();
                foreach ($request->triggers as $trig) {
                    ComponentTrigger::create([
                        'component_id' => $component->id,
                        'trigger_type' => $trig['trigger_type'] ?? 'recurring_monthly',
                        'config' => $trig['config'] ?? null,
                    ]);
                }
            }

            // Update assignments if provided
            if ($request->has('assignment_type')) {
                $this->applyAssignments($component, $request);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Komponen gaji berhasil diperbarui.',
                'data' => $component->fresh()->load(['triggers', 'assignments.user:id,name', 'assignments.role:id,name']),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Gagal memperbarui komponen gaji: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a payroll component template.
     */
    public function destroy(Request $request, $id)
    {
        $component = PayrollComponent::where('company_id', $request->user()->company_id)->findOrFail($id);
        $component->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Komponen gaji berhasil dihapus.',
        ]);
    }

    /**
     * Assign component to global, role, or users.
     */
    private function applyAssignments(PayrollComponent $component, Request $request): void
    {
        $assignmentType = $request->assignment_type ?? 'global';
        $component->assignments()->delete();

        if ($assignmentType === 'global') {
            EmployeeComponent::create([
                'component_id' => $component->id,
                'is_global' => true,
                'is_active' => true,
            ]);
        } elseif ($assignmentType === 'role' && $request->role_id) {
            EmployeeComponent::create([
                'component_id' => $component->id,
                'role_id' => $request->role_id,
                'is_global' => false,
                'is_active' => true,
            ]);
        } elseif ($assignmentType === 'users' && is_array($request->user_ids)) {
            foreach ($request->user_ids as $userId) {
                EmployeeComponent::create([
                    'component_id' => $component->id,
                    'user_id' => $userId,
                    'is_global' => false,
                    'is_active' => true,
                ]);
            }
        }
    }

    /**
     * Add manual / ad-hoc variable item to a draft salary.
     */
    public function addAdhocItem(Request $request, $salaryId)
    {
        $salary = Salary::where('company_id', $request->user()->company_id)->findOrFail($salaryId);

        if (! in_array($salary->status, ['draft', 'rejected'])) {
            return response()->json([
                'message' => 'Hanya slip gaji berstatus draft yang dapat ditambahkan variabel.',
            ], 422);
        }

        $request->validate([
            'component_name' => 'required|string|max:255',
            'type' => 'required|in:earning,deduction',
            'amount' => 'required|numeric|min:1',
            'note' => 'nullable|string|max:255',
        ]);

        $detail = PayslipDetail::create([
            'salary_id' => $salary->id,
            'component_id' => null,
            'component_name' => $request->component_name,
            'type' => $request->type,
            'calculation_rule' => 'adhoc',
            'amount' => (float) $request->amount,
            'note' => $request->note ?? 'Variabel Ad-Hoc Manual',
            'is_adhoc' => true,
        ]);

        // Recalculate salary totals
        if ($request->type === 'earning') {
            $salary->earning_others = (float) ($salary->earning_others ?? 0) + (float) $request->amount;
            $salary->earning_others_note = trim(($salary->earning_others_note ?? '')." + {$request->component_name}");
        }

        $salary->calculateTotals();
        $salary->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Variabel berhasil ditambahkan ke slip gaji.',
            'data' => [
                'detail' => $detail,
                'salary' => $salary->fresh()->load('detailsRecords'),
            ],
        ]);
    }

    /**
     * Remove an ad-hoc item from a draft salary.
     */
    public function removeAdhocItem(Request $request, $salaryId, $detailId)
    {
        $salary = Salary::where('company_id', $request->user()->company_id)->findOrFail($salaryId);

        if (! in_array($salary->status, ['draft', 'rejected'])) {
            return response()->json([
                'message' => 'Hanya slip gaji berstatus draft yang dapat diubah.',
            ], 422);
        }

        $detail = PayslipDetail::where('salary_id', $salary->id)->findOrFail($detailId);

        if ($detail->type === 'earning' && (float) $salary->earning_others >= (float) $detail->amount) {
            $salary->earning_others = (float) $salary->earning_others - (float) $detail->amount;
        }

        $detail->delete();

        $salary->calculateTotals();
        $salary->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Variabel berhasil dihapus dari slip gaji.',
            'data' => [
                'salary' => $salary->fresh()->load('detailsRecords'),
            ],
        ]);
    }
}
