<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use App\Models\Role;
use App\Models\ApprovalWorkflow;
use App\Models\WorkflowStep;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApprovalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private $company;
    private $user;
    private $role;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::create(['name' => 'SaaS Company']);
        $this->role = Role::create([
            'name' => 'HRD Manager',
            'guard_name' => 'web',
        ]);
        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
            'email' => 'admin@saas.com',
            'role_id' => $this->role->id,
        ]);
    }

    /** @test */
    public function test_it_can_fetch_roles()
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/approval-workflows/roles');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'message',
                'data' => [
                    '*' => ['id', 'name']
                ]
            ]);
    }

    /** @test */
    public function test_it_can_create_or_update_custom_workflow_with_steps()
    {
        $payload = [
            'module_key' => 'leave',
            'name' => 'Custom Cuti Workflow',
            'is_active' => true,
            'flow_json' => '{"nodes":[],"edges":[]}',
            'steps' => [
                [
                    'step_number' => 1,
                    'approver_type' => 'supervisor',
                    'sla_hours' => 12,
                ],
                [
                    'step_number' => 2,
                    'approver_type' => 'role',
                    'approver_role_id' => $this->role->id,
                    'sla_hours' => 48,
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/approval-workflows', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.module_key', 'leave')
            ->assertJsonPath('data.is_active', true);

        // Assert database records exist
        $this->assertDatabaseHas('approval_workflows', [
            'company_id' => $this->company->id,
            'module_key' => 'leave',
            'is_active' => true,
        ]);

        $this->assertDatabaseHas('workflow_steps', [
            'step_number' => 1,
            'approver_type' => 'supervisor',
            'sla_hours' => 12,
        ]);

        $this->assertDatabaseHas('workflow_steps', [
            'step_number' => 2,
            'approver_type' => 'role',
            'approver_role_id' => $this->role->id,
            'sla_hours' => 48,
        ]);
    }

    /** @test */
    public function test_it_can_fetch_specific_workflow_for_module()
    {
        $workflow = ApprovalWorkflow::create([
            'company_id' => $this->company->id,
            'module_key' => 'leave',
            'name' => 'Custom Leave',
            'is_active' => true,
        ]);

        $step = WorkflowStep::create([
            'workflow_id' => $workflow->id,
            'step_number' => 1,
            'approver_type' => 'supervisor',
            'sla_hours' => 24,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/approval-workflows/leave');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.module_key', 'leave')
            ->assertJsonPath('data.steps.0.step_number', 1);
    }

    /** @test */
    public function test_non_hrd_user_cannot_create_or_update_custom_workflow()
    {
        $employeeRole = Role::create([
            'name' => 'Karyawan',
            'guard_name' => 'web',
        ]);

        $employeeUser = User::factory()->create([
            'company_id' => $this->company->id,
            'email' => 'employee@saas.com',
            'role_id' => $employeeRole->id,
        ]);

        $payload = [
            'module_key' => 'leave',
            'name' => 'Custom Cuti Workflow By Employee',
            'is_active' => true,
            'steps' => []
        ];

        $response = $this->actingAs($employeeUser)
            ->postJson('/api/approval-workflows', $payload);

        $response->assertStatus(403);
    }
}
